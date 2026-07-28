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

## Por que o GitHub Actions faz o deploy, e não a Vercel

`vercel.json` tem `git.deploymentEnabled: false`. Com o auto-deploy da Vercel
ligado, o build começa junto com o CI e produção pode receber código antes de os
testes terminarem — o CI vira relatório, não portão. Com o deploy no Actions, a
única porta para produção passa pelos testes.

## Ambientes

| Ambiente | Banco                          | Quem deploya      | URL                     |
| -------- | ------------------------------ | ----------------- | ----------------------- |
| Local    | sua branch pessoal no Neon     | `npm run dev`     | `localhost:3000`        |
| Preview  | `preview/pr-N`, criada pelo CI | `preview.yml`     | comentada no PR         |
| Produção | branch de produção do Neon     | `release.yml`     | `PRODUCTION_URL`        |

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
exige um novo deploy.

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

## 5. Proteger a `main` (opcional, mas recomendado)

Use um **ruleset**, não a proteção de branch clássica. O `release.yml` faz push
do commit de versão e da tag direto na `main`, e só rulesets permitem liberar
esse ator específico — com proteção clássica o push do bot seria rejeitado.

```bash
gh api --method POST repos/gabrielmmf/lavanderia-app/rulesets --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Qualidade / Lint, tipos, testes e build" },
          { "context": "Qualidade / Migrations do Prisma" },
          { "context": "Changeset" }
        ]
      }
    }
  ]
}
JSON
```

`actor_id: 15368` é o app **GitHub Actions**: é ele que empurra o commit de
versão e a tag.

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

## Rodar o cron manualmente

```bash
gh workflow run cron-notifications.yml
```

## Rollback

1. **Código:** Vercel → Deployments → deploy anterior → *Promote to Production*.
2. **Banco:** não reverta migrations. Se a migration for o problema, crie uma
   nova migration corrigindo e faça uma nova release.

Diagnóstico detalhado: skill `.claude/skills/diagnosticar-deploy/SKILL.md`.
