# Deploy, ambientes e CI/CD

## Visão geral

```
branch local
    │  git push
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Pull request                                                │
│                                                             │
│  ci.yml       lint · tipos · testes · build                 │
│               migrations aplicam do zero · sem drift        │
│               changeset presente                            │
│                                                             │
│  preview.yml  cria branch `preview/pr-N` no Neon            │
│               aplica as migrations do PR nela               │
│               build + deploy de preview na Vercel           │
│               smoke test na URL do preview                  │
│               comenta a URL no pull request                 │
└─────────────────────────────────────────────────────────────┘
    │  merge na main
    ▼
┌─────────────────────────────────────────────────────────────┐
│ release.yml                                                 │
│                                                             │
│  1. os mesmos portões de qualidade, de novo                 │
│  2. changesets → nova versão + CHANGELOG                    │
│  3. tag `vX.Y.Z` + GitHub Release                           │
│  4. migrations no banco de produção                         │
│  5. deploy de produção na Vercel                            │
│  6. smoke test em produção                                  │
└─────────────────────────────────────────────────────────────┘
    │  PR fechado
    ▼
preview-cleanup.yml — apaga a branch do Neon
```

Cada passo depende do anterior: se as migrations falharem, **nada é deployado** e
produção segue na versão anterior.

## Pull requests do Dependabot

Eles passam por um caminho reduzido: **só o portão de qualidade** (lint, tipos,
testes, build e migrations). O preview e o check de changeset são pulados de
propósito.

O motivo é o mesmo dos dois: o Dependabot roda com um cofre de secrets separado
("Dependabot secrets"). Os secrets do Actions — `NEON_API_KEY`, `VERCEL_TOKEN` —
chegam **vazios** nesses PRs, e o `preview.yml` morre no primeiro passo com
`Input required and not supplied: api_key`. Espelhar os secrets para o cofre do
Dependabot resolveria o erro, mas daria a um bump de dependência qualquer acesso
ao Neon e à Vercel. Não vale: o que precisa ser verificado num bump — que o app
compila e os testes passam — o `ci.yml` já verifica.

O changeset é dispensado pelo mesmo motivo prático: não há quem o escreva. A
dependência atualizada entra na release do próximo commit de código.

Ambas as dispensas olham `github.event.pull_request.user.login`, **não** a label
`skip-changeset`. O `dependabot.yml` pede as labels `dependencies` e
`skip-changeset`, mas o Dependabot só aplica label que já exista no repositório
e ignora em silêncio as que faltam — foi assim que esses PRs chegaram sem label
nenhuma e travaram no check de changeset. As labels existem hoje; se um dia
sumirem, o CI continua correto.

## O `vercel.json`

A Vercel valida esse arquivo contra um schema **estrito**: qualquer propriedade
fora do vocabulário dela derruba o deploy. Em particular, não dá para usar
chaves `"//"` como pseudo-comentário — JSON não tem comentários, e a validação
recusa. Por isso as decisões ficam documentadas aqui:

| Campo | Por quê |
| ----- | ------- |
| `regions: ["gru1"]` | São Paulo, junto do Neon em `sa-east-1`. Sem isso as funções sobem em `iad1` e cada query cruza o continente. |
| `functions.…/cron/notifications.maxDuration: 60` | O ciclo de push pode enfileirar vários envios; 60s é o teto do plano Hobby. |
| `git.deploymentEnabled: false` | Desliga o auto-deploy por push — ver a seção abaixo. |

## Por que o GitHub Actions faz o deploy, e não a Vercel

`vercel.json` tem `git.deploymentEnabled: false`. Com o auto-deploy da Vercel
ligado, o build começa junto com o CI e produção pode receber código antes de os
testes terminarem — o CI vira relatório, não portão. Com o deploy no Actions, a
única porta para produção passa pelos testes.

## Ambientes

| Ambiente | Banco                          | Quem deploya      | URL                     |
| -------- | ------------------------------ | ----------------- | ----------------------- |
| Local    | branch `vercel-dev` do Neon    | `npm run dev`     | `localhost:3000`        |
| Preview  | `preview/pr-N`, criada pelo CI | `preview.yml`     | comentada no PR         |
| Produção | branch `production` do Neon    | `release.yml`     | `PRODUCTION_URL`        |

### Qual banco cada variável aponta

Estado auditado e correto:

| Ambiente na Vercel | `DATABASE_URL` | `DATABASE_URL_UNPOOLED` |
| ------------------ | -------------- | ----------------------- |
| Production         | `production`   | `production`            |
| Preview            | `vercel-dev`   | (ausente, não é usada)  |
| Development        | `vercel-dev`   | `vercel-dev`            |

O `DATABASE_URL` de Preview é apenas **fallback**: o `preview.yml` injeta a URL
da branch do PR por deployment (`vercel deploy --env DATABASE_URL=...`), que tem
precedência sobre a variável do projeto. O fallback aponta para `vercel-dev`
justamente para que um `vercel deploy` manual, fora do CI, nunca toque produção.

> Auditoria de 2026-07-28: antes disso, **Preview e Development apontavam para
> `production`**. Development era ainda pior: o app lia produção
> (`DATABASE_URL`) enquanto as migrations iam para `vercel-dev`
> (`DATABASE_URL_UNPOOLED`) — incoerência silenciosa.

O smoke test do CI passou a **exigir** que o deploy esteja no banco esperado,
via `/api/health`. Se um preview apontar para produção, o pull request falha.

### Cuidado: a integração Neon↔Vercel

Existe uma integração Neon↔Vercel instalada neste projeto. Ela cria branches de
banco por conta própria — foi ela que criou `vercel-dev` e, quando o CI passou a
deployar pela CLI, uma branch órfã `preview/HEAD` (o deploy via CLI não carrega
metadados de git, então o nome resolve para `HEAD`).

Branches criadas por ela **não têm anotações**; as nossas carregam
`github-pr-number` e afins, o que permite distinguir a origem:

```bash
curl -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID" \
  | jq '.annotation.value'
```

O `preview-cleanup.yml` só apaga `preview/pr-N`, então as órfãs se acumulam e
consomem a cota (plano free: **10 branches**). Recomendado desativar a criação
automática de branches da integração em **Vercel → Settings → Integrations →
Neon**, já que o CI faz isso de forma determinística e com limpeza automática.

### A cota de compute do Neon

O plano free dá **100 CU-horas por projeto por mês**, o compute mínimo é
**0,25 CU** e o autosuspend é **fixo em 5 minutos** — no free ele não é
configurável. Traduzindo para o que importa na prática:

```
100 CU-horas ÷ 0,25 CU = 400 horas de banco ACORDADO por mês ≈ 13 h/dia
```

Qualquer coisa que mantenha o banco acordado 24 horas por dia estoura a cota por
volta do dia 17 do mês. Foi o que aconteceu em **19/08/2026**: o cron de
notificações chamava `/api/cron/notifications` a cada 5 minutos e o ciclo
consultava o banco em toda chamada, ou seja, acordava o compute exatamente no
ritmo em que ele tentaria dormir. Consumo medido: 110,1 de 100 CU-horas no dia
19, ~5,9 CU-horas por dia — que é 0,25 CU ligado ininterruptamente. O banco foi
suspenso e o app passou a responder erro `53000`
(`Your account or project has exceeded the compute time quota`).

Com o autosuspend fixo em 5 minutos, **o intervalo do cron é o ciclo de trabalho
do banco**:

| Intervalo do cron          | Banco acordado | CU-horas/mês | Cabe em 100? |
| -------------------------- | -------------- | ------------ | ------------ |
| 5 min                      | ~100%          | ~180         | ❌            |
| 10 min                     | ~50%           | ~91          | ⚠️ sem folga  |
| 15 min                     | ~33%           | ~61          | ✅            |
| 20 min, só das 7h às 23h   | ~17%           | ~31          | ✅            |
| desligado (estado atual)   | só o uso real  | ~15–20       | ✅            |

O que **não** resolve: apagar branches. Branch parada não consome — as três
(`production`, `vercel-dev`, `preview/pr-N`) apareciam `Idle` no dashboard
enquanto a cota queimava. Reduzir o tamanho do compute também não: o consumo já
batia com o piso de 0,25 CU, então a faixa `.25 ↔ 2 CU` nunca chegou a escalar.

Diagnóstico rápido:

```bash
curl -s "$PRODUCTION_URL/api/health" | jq .database
# {"reachable": false, ...}  →  banco suspenso; confira Billing no console do Neon
```

O contador zera no primeiro dia de cada mês, e as CU-horas já gastas não voltam:
enquanto a cota está estourada, **nem `pg_dump` conecta**. Um upgrade destrava na
hora (o compute precisa reiniciar para pegar os limites novos).

## Migrations: a regra expand/contract

As migrations rodam **antes** do deploy. Existe uma janela de segundos em que o
código antigo está no ar com o schema novo. Portanto:

✅ Pode ir num pull request: `ADD COLUMN` nullable ou com default, `CREATE TABLE`,
`CREATE INDEX`, tornar coluna opcional.

❌ Precisa de dois pull requests: `DROP COLUMN`, `RENAME`, mudar tipo,
`ADD COLUMN NOT NULL` sem default.

Para os ❌: primeiro a release que **adiciona** e faz o código usar os dois
caminhos; depois, numa release seguinte, a que **remove** o antigo.

Isso também é o que torna o Instant Rollback da Vercel seguro: voltar o código
não desfaz a migration, e o código anterior continua funcionando com o schema
novo.

## Pooled vs unpooled

| Variável                | Host            | Uso                               |
| ----------------------- | --------------- | --------------------------------- |
| `DATABASE_URL`          | `...-pooler...` | runtime do app (serverless)       |
| `DATABASE_URL_UNPOOLED` | sem `-pooler`   | `prisma migrate`, `prisma studio` |

O pooler do Neon (PgBouncer em modo transaction) não suporta os advisory locks
que o `prisma migrate` usa. `prisma.config.ts` prefere a conexão direta.

---

# Configuração inicial (uma vez)

## 1. Secrets do repositório

```bash
gh secret set NEON_API_KEY                       # console.neon.tech → Account settings → API keys
gh secret set VERCEL_TOKEN                       # vercel.com/account/tokens
gh secret set VERCEL_ORG_ID                      # cat .vercel/project.json → orgId
gh secret set VERCEL_PROJECT_ID                  # cat .vercel/project.json → projectId
gh secret set PRODUCTION_DATABASE_URL_UNPOOLED   # Neon: conexão DIRETA (sem -pooler)
gh secret set CRON_SECRET                        # o mesmo valor configurado na Vercel
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET    # ver abaixo
```

### `VERCEL_AUTOMATION_BYPASS_SECRET`

Deployments de preview ficam atrás do Deployment Protection da Vercel e
respondem com redirect para o SSO — inclusive para o smoke test do CI, que
falharia sempre.

Em **Vercel → Settings → Deployment Protection → Protection Bypass for
Automation**, gere o segredo e guarde-o como secret do repositório. O smoke test
o envia no header `x-vercel-protection-bypass`.

Sem ele o job de preview falha com uma mensagem explicando exatamente isso.

## 2. Variables do repositório

```bash
gh variable set NEON_PROJECT_ID --body "<project id do Neon>"
gh variable set NEON_PRODUCTION_BRANCH --body "main"
gh variable set PRODUCTION_URL --body "https://lavanderia-app-two.vercel.app"
```

## 3. Variáveis na Vercel

Gere as chaves VAPID:

```bash
npx web-push generate-vapid-keys
```

Adicione em **Production, Preview e Development**:

```bash
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY <ambiente>
npx vercel env add VAPID_PRIVATE_KEY <ambiente>
npx vercel env add CRON_SECRET <ambiente>   # gere com: openssl rand -hex 32
npx vercel env add VAPID_SUBJECT <ambiente> # opcional: mailto:voce@exemplo.com
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` é embutida no bundle em tempo de build: trocá-la
exige um novo deploy. O mesmo vale para `NEXT_PUBLIC_NOTIFICATIONS_ENABLED`, que
liga ou desliga o ciclo inteiro (ver "Quem dispara as notificações"). Ela não
está definida em nenhum ambiente hoje — ausente significa **desligado**, que é o
estado desejado enquanto o cron não voltar.

Cole o valor **cru**, sem aspas e sem espaços em volta. A chave pública tem
exatamente 87 caracteres do alfabeto base64url (`A-Z a-z 0-9 - _`); qualquer
outra coisa — inclusive um placeholder copiado de um log com segredos
mascarados — faz o navegador recusar a inscrição, e o app passa a mostrar o
botão como desativado. Para conferir o que está no ar:

```bash
curl -s https://lavanderia-app-two.vercel.app/api/health | jq .notifications
# {"enabled": false, "configured": true}
#   enabled    → decidimos ligar o ciclo? (NEXT_PUBLIC_NOTIFICATIONS_ENABLED)
#   configured → as chaves VAPID deste deploy servem?
```

O smoke test do release imprime esse mesmo estado ao final de cada deploy.

### As chaves VAPID não podem ser `sensitive` na Vercel

Esta é a armadilha que manteve as notificações mortas em produção, e ela não
dá nenhum sinal: o deploy fica verde e o app sobe normalmente.

A Vercel tem dois tipos de variável encriptada. Uma variável `sensitive` **não
pode ser lida de volta** — nem pela API, nem pelo CLI. E o deploy deste projeto
é construído no runner, não na Vercel:

```
vercel pull    →  grava .vercel/.env.<ambiente>.local
vercel build   →  lê esse arquivo e inlina NEXT_PUBLIC_* no bundle
vercel deploy --prebuilt
```

Se a variável for `sensitive`, o `pull` escreve a string literal
`[SENSITIVE]` no arquivo, e o `build` assa esse texto no bundle como se fosse a
chave. O resultado é um `NEXT_PUBLIC_VAPID_PUBLIC_KEY` de 11 caracteres
servido a todo navegador, e um `notifications.configured: false` no health.

Confira o tipo com:

```bash
vercel env ls production        # a coluna mostra Encrypted vs Sensitive
```

As três variáveis de push precisam ser **`encrypted`**. Marcar a chave pública
como secreta é contradição em termos: ela é servida ao navegador por definição.
A partir de agora o smoke test reprova o deploy nesse estado, então o erro não
volta calado.

### O `CRON_SECRET` precisa bater entre Vercel e GitHub

O `CRON_SECRET` da Vercel e o secret de mesmo nome no GitHub **têm que ser o
mesmo valor** — é ele que o `cron-notifications.yml` envia no header. Divergiu,
o endpoint responde 401.

`DATABASE_URL_UNPOOLED` **não** precisa existir na Vercel: nada em runtime a
usa. Ela só é necessária onde `prisma migrate` roda — no GitHub Actions (secret
`PRODUCTION_DATABASE_URL_UNPOOLED`) e no seu `.env.local`.

⚠️ O `DATABASE_URL` do ambiente **Preview** na Vercel ainda aponta para o banco
de produção. Isso não afeta os previews do CI, que recebem a URL da branch do
Neon por deployment (`vercel deploy --env DATABASE_URL=...`), com precedência
sobre a variável do projeto. Mas um `vercel deploy` manual, fora do CI, usaria
produção — não faça isso.

## 4. Desligar o auto-deploy da Vercel

Já está em `vercel.json` (`git.deploymentEnabled: false`), aplicado no primeiro
deploy feito pelo Actions. Confirme depois em
**Vercel → Settings → Git** que os deploys automáticos estão desativados.

## 5. Proteção da `main`

O ruleset `protecao-da-main` está ativo com **`deletion` + `non_fast_forward`**.
Isso não é preguiça: é o limite do que dá para exigir sem quebrar o release.

### Por que não exigimos status checks nem pull request

O `release.yml` empurra o commit de versão direto na `main` como
`github-actions[bot]`. Em repositório **pessoal** (não de organização), o
GitHub recusa `Integration` como bypass actor:

> Actor GitHub Actions integration must be part of the ruleset source or owner organization

O bot também não é coberto pelo bypass de `RepositoryRole: admin`. Testado com
um ruleset espelho numa branch descartável, fazendo o próprio bot tentar o push:

| Regras do ruleset                           | Push do bot | Erro                                        |
| ------------------------------------------- | ----------- | ------------------------------------------- |
| `deletion` + `non_fast_forward`             | ✅ aceito   | —                                           |
| \+ `required_status_checks`                 | ❌ recusado | `GH013: 3 of 3 required status checks are expected` |
| \+ `pull_request`                           | ❌ recusado | `Changes must be made through a pull request` |

### O que ainda protege produção

Mesmo sem exigir PR na `main`, **código ruim não chega em produção**: o
`release.yml` roda o mesmo portão de qualidade (lint, tipos, testes, build,
migrations, drift) antes de tocar em qualquer coisa. Um push direto de código
quebrado falha no release e produção continua no deploy anterior.

O ruleset cobre o que o pipeline não cobre: reescrita de história e remoção da
branch.

### Se quiser exigência forte (opcional)

Para exigir PR e checks verdes na `main`, o push do release precisa vir de um
ator com bypass — na prática, um **PAT fine-grained do dono** com `contents:
write`:

1. Crie o PAT e guarde como secret `RELEASE_TOKEN`.
2. No `release.yml`, use-o no `actions/checkout` (`token: ${{ secrets.RELEASE_TOKEN }}`).
3. Adicione de volta as regras `pull_request` e `required_status_checks`.

Atenção ao efeito colateral: push com PAT **dispara workflows** (o
`GITHUB_TOKEN` não dispara). O `[skip ci]` na mensagem do commit de versão já
existe justamente para evitar o loop de release, mas confirme antes de trocar.

### Comando aplicado

```bash
gh api --method POST repos/gabrielmmf/lavanderia-app/rulesets --input - <<'JSON'
{
  "name": "protecao-da-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
JSON
```

 é o papel **Repository admin** — você. O bot do Actions não é
coberto por nenhum bypass disponível em repositório pessoal, por isso as regras
se limitam às duas acima.

Isto é defesa em profundidade, não o portão principal: o `release.yml` roda os
mesmos checks de qualidade **de novo** antes de tocar em produção. Mesmo sem
ruleset, um merge com código quebrado não chega ao ar — ele apenas falharia mais
tarde, no release, em vez de no pull request.

## 6. Ambientes do GitHub (opcional)

`preview.yml` e `release.yml` declaram os environments `preview` e `production`.
Criá-los em **Settings → Environments** dá histórico de deploy e permite exigir
aprovação manual antes da produção.

---

# Operação

## Ver o que está no ar

```bash
gh run list --workflow=release.yml --limit 5
npx vercel ls lavanderia-app
gh release list --limit 5
```

## Quem dispara as notificações

> **DESLIGADAS desde 19/08/2026** — cota de compute do Neon. Enquanto
> `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` não for `true`, nenhum caminho de
> notificação toca o banco: o ciclo retorna antes da primeira consulta, as
> rotas de inscrição respondem 503 e a UI mostra o botão como "Desativadas".
> O motivo e as contas estão em "A cota de compute do Neon". O resto desta
> seção descreve como o envio funciona **quando ligado**.

O envio é *pull*: alguém precisa chamar `GET /api/cron/notifications` com o
`CRON_SECRET` no header. Quem chama são duas fontes, de propósito.

### 1. cron-job.org — o agendador de verdade

O `schedule` do GitHub Actions **não é pontual**. Em agosto de 2026 este
repositório recebia uma execução a cada 1 a 3 horas, apesar do `*/5 * * * *`.
É comportamento conhecido: o GitHub desprioriza `schedule` em repositórios de
pouco tráfego, e não há configuração que resolva. Para um aviso de "faltam 15
minutos", isso é inútil.

O agendador pontual é um job gratuito no [cron-job.org](https://cron-job.org):

| Campo | Valor |
| ----- | ----- |
| URL | `https://lavanderia-app-two.vercel.app/api/cron/notifications` |
| Schedule | a cada 5 minutos |
| Header | `Authorization: Bearer <CRON_SECRET>` |

O `CRON_SECRET` é o mesmo valor que está na Vercel e no secret do GitHub.
Qualquer agendador HTTP serve — o endpoint aceita GET e POST e é idempotente.

### 2. GitHub Actions — rede de segurança

O `cron-notifications.yml` não garante pontualidade, mas garantia que nada
ficasse parado para sempre se o agendador externo caísse. Como o ciclo tolera
atraso (ver abaixo), um disparo tardio ainda entrega o que ficou para trás.

O `schedule` dele está **comentado** desde 19/08/2026: mesmo espaçado em 1 a 3
horas pelo GitHub, ele sozinho manteria o banco acordado boa parte do dia. O
`workflow_dispatch` continua disponível para disparo manual.

### Como religar

Os quatro passos valem juntos — qualquer um sozinho não funciona, e o primeiro
sem os outros volta a queimar a cota:

1. Escolha um intervalo que caiba na cota (ver a tabela em "A cota de compute do
   Neon"). No plano free, 5 minutos **não** cabe.
2. `npx vercel env add NEXT_PUBLIC_NOTIFICATIONS_ENABLED production` com o valor
   `true`, e **faça um novo deploy** — o valor é embutido no bundle em build
   time, mudar no painel não afeta um deploy já existente.
3. Descomente o `schedule` de `.github/workflows/cron-notifications.yml` com o
   intervalo escolhido.
4. Recrie o job no cron-job.org, no mesmo intervalo.

Confira em `/api/health`: `notifications.enabled` precisa virar `true`. Se
`configured` estiver `false`, as chaves VAPID também precisam de atenção antes
de qualquer coisa.

Se o intervalo escolhido for maior que `NOTIFICATION_LEAD_MINUTES` (15), suba o
lead junto — senão o aviso de "faltam 15 minutos" passa a chegar depois do
horário começar, dentro da tolerância de `NOTIFICATION_GRACE_MINUTES`.

### Por que o atraso não perde mais a notificação

O ciclo busca de `now - NOTIFICATION_GRACE_MINUTES` até
`now + NOTIFICATION_LEAD_MINUTES`. A borda inferior é o conserto: antes a busca
começava em `now`, então um agendamento cuja hora do aviso caísse entre dois
ciclos saía da janela com `startNotified` ainda `false` e **nunca mais** era
notificado. O texto da mensagem é calculado na hora do envio, então um aviso
atrasado diz "já começou" em vez de mentir "começa em 15 minutos".

### Rodar à mão

```bash
gh workflow run cron-notifications.yml            # via Actions

curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://lavanderia-app-two.vercel.app/api/cron/notifications
# ligado:    {"success":true,"enabled":true,"sent":0,...}
# desligado: {"success":true,"enabled":false,"message":"Notificações desligadas..."}
#            (200, e sem nenhuma consulta ao banco)
```

## Rollback

1. **Código:** Vercel → Deployments → deploy anterior → *Promote to Production*.
2. **Banco:** não reverta migrations. Se a migration for o problema, crie uma
   nova migration corrigindo e faça uma nova release.

## Limpeza automática

O `limpeza.yml` roda toda segunda-feira e também sob demanda:

```bash
gh workflow run limpeza.yml                      # simula, não apaga
gh workflow run limpeza.yml -f apply=true        # apaga de verdade
```

**Deployments da Vercel** — remove previews com mais de 14 dias, preservando
sempre: todos os de produção (são os alvos de rollback), os 5 previews mais
recentes, e qualquer um com alias ativo.

**Branches do Neon** — apenas *relata* branches `preview/*` sem pull request
aberto, sem apagar. Apagar automaticamente banco é uma linha que não vale a pena
cruzar: o relatório aparece no resumo da execução e a remoção é decisão sua.

O caminho normal já se limpa sozinho: o `preview-cleanup.yml` apaga
`preview/pr-N` ao fechar o pull request, e o repositório está configurado para
apagar a branch do git no merge.

Diagnóstico detalhado: skill `.claude/skills/diagnosticar-deploy/SKILL.md`.
