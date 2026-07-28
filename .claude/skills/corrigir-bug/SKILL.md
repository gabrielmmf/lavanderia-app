---
name: corrigir-bug
description: Fluxo para investigar e corrigir bugs no lavanderia-app, com teste de regressão obrigatório. Use quando o pedido for "não está funcionando", "está dando erro", "corrija", "o deploy falhou", "os testes quebraram" ou qualquer relato de comportamento errado. Inclui os pontos onde este app costuma quebrar.
---

# Corrigir um bug

Regra que não se negocia: **todo bug corrigido ganha um teste que falha antes da
correção e passa depois.** Sem isso o bug volta.

## 1. Reproduza antes de consertar

Nunca corrija a partir da descrição. Primeiro torne a falha visível:

```bash
npm test              # já existe teste cobrindo isso?
npm run typecheck     # é erro de tipo?
npm run lint          # é erro de lint?
npm run build         # só quebra no build?
```

Se o relato veio do CI, veja o log real:

```bash
gh run list --limit 5
gh run view <id> --log-failed
```

Se veio da produção ou de um preview:

```bash
gh pr checks              # estado dos checks do PR atual
npx vercel logs <url>     # logs de runtime do deploy
```

## 2. Escreva o teste que falha

Antes de tocar no código de produção, escreva o teste que reproduz o bug e
confirme que ele **falha**:

```bash
npx vitest run src/lib/booking-service.test.ts
```

Um teste que passa antes da correção não está testando o bug.

## 3. Corrija na camada certa

Corrija onde está a causa, não onde apareceu o sintoma:

- Sintoma na UI, causa em regra de negócio → corrija em `src/lib/`.
- Sintoma na API, causa em validação → corrija no serviço, não no `route.ts`.
- Número errado espalhado → centralize em `src/lib/booking-rules.ts`.

## 4. Valide e entregue

```bash
npm run verify
```

Depois: changeset `patch` descrevendo o que estava errado do ponto de vista do
morador.

```markdown
---
"lavanderia-app": patch
---

Corrige a notificação de término, que não era enviada quando o apartamento
tinha mais de um dispositivo cadastrado.
```

Depois commite (`fix: ...`) e abra o pull request — ver seções 8 e 9 da skill
`desenvolver-feature`. O commit é seu, não do usuário.

## Onde este app costuma quebrar

### `schema.prisma` fora de sincronia com as migrations

**Sintoma:** `Property 'x' does not exist on type 'PrismaClient'`, ou
`'campo' does not exist in type 'BookingWhereInput'`.

**Causa:** alguém escreveu a migration SQL sem atualizar o `schema.prisma` (ou o
contrário). O client é gerado a partir do **schema**, não das migrations.

**Correção:** acerte o `schema.prisma`, rode `npm run db:generate`, e confirme
com o check de drift descrito na skill `migracao-banco`.

### `setState` dentro de `useEffect`

**Sintoma:** `error react-hooks/set-state-in-effect` no lint.

**Correção:** `useSyncExternalStore`. Modelo em `src/lib/apartment-storage.ts`.
Detalhes na skill `desenvolver-feature`.

### Variável de ambiente lida no topo do módulo

**Sintoma:** build ou rota quebra num ambiente e funciona em outro.

**Causa:** ler uma env var obrigatória em escopo de módulo faz o import falhar
onde ela não existe. Foi assim que `webPush.setVapidDetails` derrubou a rota de
cron inteira.

**Correção:** leia sob demanda, dentro da função, e degrade com elegância —
veja `ensureVapidConfigured()` em `src/lib/notification-service.ts`.

### Migration falhando no Neon

**Sintoma:** `prisma migrate deploy` trava ou erra em advisory lock.

**Causa:** a migration está usando a conexão *pooled*. O pooler do Neon não
suporta o que o migrate precisa.

**Correção:** `prisma.config.ts` já prefere `DATABASE_URL_UNPOOLED`. Garanta que
essa variável existe no ambiente em que o comando roda.

### Fuso horário

Datas são gravadas em UTC e exibidas em `pt-BR`. Ao testar limites de dia
(`listBookingsByDate`), use `new Date(ano, mes, dia)` — que é hora local — em vez
de string ISO, para não comparar fusos diferentes sem perceber.

### Deploy de preview usando o banco errado

Cada pull request tem sua branch no Neon (`preview/pr-N`). Se o preview parecer
estar lendo dados de produção, veja o workflow `preview.yml` e a skill
`diagnosticar-deploy`.
