---
name: diagnosticar-deploy
description: Diagnostica problemas de CI/CD, Vercel, Neon e release do lavanderia-app. Use quando o deploy falhar, o preview não subir, a produção estiver fora do ar, a versão não tiver sido gerada, as migrations não tiverem aplicado, ou quando o usuário perguntar "por que não foi para produção?" / "o que está no ar?".
---

# Diagnosticar CI/CD, Vercel e Neon

## Mapa de quem faz o quê

```
push na branch  ─▶ ci.yml         qualidade + changeset
                └▶ preview.yml    branch Neon ─▶ migrations ─▶ deploy preview ─▶ smoke test

merge na main   ─▶ release.yml    qualidade ─▶ versão+tag+release
                                   ─▶ migrations em produção ─▶ deploy prod ─▶ smoke test

PR fechado      ─▶ preview-cleanup.yml   apaga a branch do Neon

a cada 5 min    ─▶ cron-job.org (externo)   chama /api/cron/notifications — agendador principal
a cada 1-3h     ─▶ cron-notifications.yml    mesma chamada — rede de segurança, GitHub não é pontual
```

A Vercel **não** faz deploy sozinha: `vercel.json` tem
`git.deploymentEnabled: false`. Se alguém reativar isso no painel, produção pode
receber código que não passou pelo CI.

## Comandos de diagnóstico

```bash
gh run list --limit 10                        # últimas execuções
gh run view <id> --log-failed                 # só o que falhou
gh run list --workflow=release.yml --limit 5  # histórico de releases
gh pr checks                                  # checks do PR atual

npx vercel ls lavanderia-app                  # deploys recentes
npx vercel logs <url-do-deploy>               # logs de runtime
npx vercel env ls                             # variáveis por ambiente
npx vercel project inspect lavanderia-app     # configuração do projeto
```

## "O deploy de produção não aconteceu"

Verifique em ordem:

1. **O `release.yml` rodou?** `gh run list --workflow=release.yml --limit 3`
   - Não rodou → o merge foi para `main`? o workflow existe na `main`?
2. **O job `quality` passou?** Se não, produção foi protegida corretamente —
   corrija o código.
3. **O passo de migrations falhou?** Ver seção de migrations abaixo. Se falhou
   aqui, **nada foi deployado** — produção continua na versão anterior, que é o
   comportamento desejado.
4. **O passo de deploy falhou?** Provavelmente `VERCEL_TOKEN` expirado.

## "A versão não foi gerada"

O `release.yml` só bumpa versão se houver arquivo em `.changeset/` além do
`README.md`. Sem changeset, ele deploya mas mantém a versão — e diz isso no log:

> Nenhum changeset pendente — mantendo a versão atual.

Se havia changeset e mesmo assim não versionou, veja o passo "Aplicar
changesets" no log.

O push da tag usa o `GITHUB_TOKEN` padrão, que **por design não dispara novos
workflows** — é isso que evita loop infinito de release. Se um dia alguém trocar
por um PAT, o loop volta (o `[skip ci]` na mensagem do commit existe para isso).

## "O release falhou ao empurrar o commit de versão"

Erro `GH013: Repository rule violations found for refs/heads/main`.

O ruleset da `main` passou a exigir algo que o bot do Actions não consegue
satisfazer. Em repositório pessoal o bot **não é coberto por nenhum bypass**:
`Integration` é recusado na criação do ruleset e `RepositoryRole: admin` não se
aplica a ele. Verificado empiricamente:

| Regras do ruleset               | Push do bot |
| ------------------------------- | ----------- |
| `deletion` + `non_fast_forward` | ✅ aceito   |
| \+ `required_status_checks`     | ❌ recusado |
| \+ `pull_request`               | ❌ recusado |

O release para **antes** das migrations e do deploy, então produção fica
intacta. Remova a regra extra do ruleset e re-execute o workflow, ou migre o
push para um PAT do dono (ver `docs/DEPLOY.md`).

## "O preview não subiu"

| Sintoma no log                                  | Causa                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| falha em `Criar/reutilizar branch no Neon`      | `NEON_API_KEY` ou `NEON_PROJECT_ID` ausente/errado |
| falha em `Aplicar migrations na branch do PR`   | a migration está quebrada — é o CI funcionando |
| falha em `vercel pull`                          | `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` |
| `Invalid vercel.json - should NOT have additional property` | Campo fora do schema da Vercel. Não existe comentário em `vercel.json` (nem chaves `"//"`); documente em `docs/DEPLOY.md`. |
| smoke test: "bloqueado pelo Deployment Protection" | falta `VERCEL_AUTOMATION_BYPASS_SECRET`     |
| falha no smoke test                             | build ok, app não responde → `npx vercel logs` |
| o job nem começou                               | PR vindo de fork ou do Dependabot (sem secrets) — é esperado |

## "Os pull requests do Dependabot estão vermelhos"

Eles rodam **só o portão de qualidade**; preview e changeset são pulados pelo
autor do PR (`github.event.pull_request.user.login == 'dependabot[bot]'`). Se
mesmo assim falharem:

| Job que falhou                | O que significa                                  |
| ----------------------------- | ------------------------------------------------ |
| `Banco + deploy de preview`   | o guard do `preview.yml` foi removido. PR do Dependabot lê o cofre "Dependabot secrets", então `NEON_API_KEY` chega vazio: `Input required and not supplied: api_key` |
| `Changeset`                   | o guard do `ci.yml` foi removido. Não confie na label: o Dependabot só aplica label que **já exista** no repositório (`gh label list`) e ignora as que faltam, em silêncio |
| `Qualidade`                   | **é o CI funcionando** — a dependência nova quebrou lint/tipos/testes/build. Corrija ou feche o PR |

O detalhamento está em `docs/DEPLOY.md`.

## "As migrations não aplicaram"

```bash
npm run db:status    # com DATABASE_URL_UNPOOLED apontando para o alvo
```

Causas comuns:

- **Conexão pooled.** `prisma migrate` não funciona pelo pooler do Neon.
  `prisma.config.ts` prefere `DATABASE_URL_UNPOOLED`; garanta que ela existe no
  ambiente onde o comando roda.
- **Checksum divergente.** Alguém editou uma migration já aplicada. Nunca edite
  uma migration commitada — crie outra corrigindo.
- **Migration falhou no meio.** O Prisma marca como `rolled_back_at`. Resolva
  com `prisma migrate resolve` e **avise o usuário antes** — isso mexe em
  produção.

## "Produção está fora do ar"

1. `npx vercel ls lavanderia-app` — o deploy mais recente está `Ready`?
2. `npx vercel logs <url>` — erro de runtime?
3. Se for regressão recente, o caminho mais rápido é promover o deploy anterior
   pelo painel da Vercel (Instant Rollback). **Isso não desfaz migrations** —
   por isso migrations aditivas importam: a versão anterior continua funcionando
   com o schema novo.
4. Reverter código: abra um pull request revertendo o commit. Não faça push
   direto na `main`.

## "As notificações pararam"

Quem dispara o envio é o **cron-job.org** (a cada 5 minutos), com o workflow
`cron-notifications.yml` como rede de segurança. Detalhes em `docs/DEPLOY.md`,
seção "Quem dispara as notificações".

1. `curl -s "$PRODUCTION_URL/api/health"` → confira `notifications.configured`.
   - `false` → o VAPID não está utilizável neste deploy. Vá direto para o item 3.
2. O endpoint de envio responde? Ele exige o header e **falha fechado** sem
   `CRON_SECRET`:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "$PRODUCTION_URL/api/cron/notifications"
   ```

   - `401` → `CRON_SECRET` do repositório (ou do cron-job.org) difere do da
     Vercel. Lembre que uma variável `sensitive` não pode ser conferida —
     rotacione e sincronize os três lugares (ver item 3).
   - `503` com `"vapidConfigured":false` → as chaves VAPID estão ausentes ou
     inválidas. Vá para o item 3.
   - `200` com `"sent":0` → não é erro, só não havia nada na janela dos
     próximos `NOTIFICATION_LEAD_MINUTES` nem nos últimos
     `NOTIFICATION_GRACE_MINUTES` de atraso tolerado.
3. **Confira o *tipo* das variáveis na Vercel, não só se elas existem.**
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `CRON_SECRET` precisam
   ser `encrypted`. Se estiverem como `sensitive`, o `vercel pull` do CI grava
   a string literal `"[SENSITIVE]"` no lugar do valor, e o `vercel build` assa
   esse texto no bundle — o deploy sobe verde e a chave pública fica com 11
   caracteres em vez de 87. Foi exatamente isso que manteve as notificações
   mortas em produção por dias, sem nenhum sinal no CI.

   ```bash
   npx vercel env ls production      # a coluna mostra Encrypted vs Sensitive
   ```

   O CI reprova esse estado automaticamente antes do build
   (`.github/scripts/check-env-types.mjs`, chamado por `preview.yml` e
   `release.yml`) — se esse passo falhar, é exatamente este problema.
4. Mudou alguma dessas variáveis? **Precisa de um novo deploy** —
   `NEXT_PUBLIC_*` é embutida no bundle em build time, e mesmo as variáveis só
   de servidor ficam congeladas no deployment desde quando ele foi criado;
   mudar o valor no painel não afeta um deploy já existente.
5. O `schedule` do GitHub **não é pontual** — neste repositório chegou a
   espaçar execuções em 1 a 3 horas, apesar do `*/5`. Não é o agendador
   principal; é só a rede de segurança. Se o cron-job.org também estiver
   falhando, o ciclo ainda tolera atraso de até `NOTIFICATION_GRACE_MINUTES`
   (a janela de busca começa em `now - GRACE`, não em `now`), então um
   disparo tardio entrega o que ficou para trás em vez de perder o aviso.

## Configuração esperada do repositório

Secrets (`gh secret list`):

| Nome                            | Usado por                    |
| ------------------------------- | ---------------------------- |
| `NEON_API_KEY`                  | preview, preview-cleanup     |
| `VERCEL_TOKEN`                  | preview, release             |
| `VERCEL_ORG_ID`                 | preview, release             |
| `VERCEL_PROJECT_ID`             | preview, release             |
| `PRODUCTION_DATABASE_URL_UNPOOLED` | release (migrations)      |
| `CRON_SECRET`                   | cron-notifications           |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | smoke test do preview      |

Variables (`gh variable list`):

| Nome                     | Exemplo                              |
| ------------------------ | ------------------------------------ |
| `NEON_PROJECT_ID`        | `wispy-...`                          |
| `NEON_PRODUCTION_BRANCH` | `main` (opcional, default `main`)    |
| `PRODUCTION_URL`         | `https://lavanderia-app-two.vercel.app` |

Variáveis na Vercel (`npx vercel env ls`) — todos os ambientes:
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`. Todas precisam ser do tipo
**`encrypted`** — nunca `sensitive` (ver "As notificações pararam" acima). O
CI confere isso sozinho antes de cada build (`check-env-types.mjs`).

Externo, fora do GitHub e da Vercel: um cronjob no **cron-job.org** chamando
`/api/cron/notifications` a cada 5 minutos com o mesmo `CRON_SECRET`. É o
agendador principal das notificações — não tem como ver o estado dele por
`gh` ou `vercel`, só entrando na conta do cron-job.org.

O passo a passo de configuração está em `docs/DEPLOY.md`.
