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

a cada 5 min    ─▶ cron-notifications.yml  chama /api/cron/notifications
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
por um PAT, o loop volta.

## "O preview não subiu"

| Sintoma no log                                  | Causa                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| falha em `Criar/reutilizar branch no Neon`      | `NEON_API_KEY` ou `NEON_PROJECT_ID` ausente/errado |
| falha em `Aplicar migrations na branch do PR`   | a migration está quebrada — é o CI funcionando |
| falha em `vercel pull`                          | `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` |
| `Invalid vercel.json - should NOT have additional property` | Campo fora do schema da Vercel. Não existe comentário em `vercel.json` (nem chaves `"//"`); documente em `docs/DEPLOY.md`. |
| smoke test: "bloqueado pelo Deployment Protection" | falta `VERCEL_AUTOMATION_BYPASS_SECRET`     |
| falha no smoke test                             | build ok, app não responde → `npx vercel logs` |
| o job nem começou                               | PR vindo de fork (sem secrets) — é esperado    |

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

1. O cron está rodando? `gh run list --workflow=cron-notifications.yml --limit 5`
2. O endpoint responde? Ele exige o header e **falha fechado** sem `CRON_SECRET`:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "$PRODUCTION_URL/api/cron/notifications"
   ```

   - `401` → `CRON_SECRET` do repositório difere do da Vercel.
   - `{"sent":0}` sempre → sem inscrições, ou VAPID não configurado. O serviço
     registra `VAPID não configurado — ciclo de notificações ignorado.` e
     devolve zeros em vez de quebrar.
3. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` precisa estar na Vercel **em build time** —
   variáveis `NEXT_PUBLIC_*` são embutidas no bundle. Mudou a chave? precisa de
   novo deploy.
4. O GitHub atrasa `schedule` em horários de pico. Atraso de alguns minutos é
   normal e não perde notificação: a janela é de 15 minutos e o endpoint é
   idempotente.

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
`VAPID_PRIVATE_KEY`, `CRON_SECRET`.

O passo a passo de configuração está em `docs/DEPLOY.md`.
