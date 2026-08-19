# lavanderia-app

App de agendamento da lavanderia do Studio 733. Moradores reservam uma das três
máquinas por faixa de horário, e recebem notificação push antes do início e do
término da reserva.

Não há login: o morador se identifica pelo número do apartamento, guardado no
`localStorage`. Isso é intencional — é um prédio pequeno e o custo de uma tela
de autenticação não se paga. **Não introduza autenticação sem pedir.**

## Stack

| Camada    | Escolha                                              |
| --------- | ---------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19          |
| Estilo    | Tailwind CSS 4 + shadcn/ui (`src/components/ui/`)     |
| Dados     | Prisma 7 com driver adapter `@prisma/adapter-pg`      |
| Banco     | PostgreSQL no Neon (região `sa-east-1`)               |
| Hospedagem| Vercel (região `gru1`), deploy feito pelo GitHub Actions |
| Testes    | Vitest + Testing Library                              |
| Versão    | Changesets                                            |

## Comandos

```bash
npm run dev            # servidor de desenvolvimento
npm run verify         # lint + tipos + testes + build — rode antes de terminar
npm test               # só os testes
npm run test:watch     # testes em watch
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:migrate     # cria migration a partir do schema (desenvolvimento)
npm run db:generate    # regenera o Prisma Client
npm run db:status      # migrations aplicadas vs pendentes
npm run changeset      # descreve a mudança para o versionamento
```

## Estrutura

```
src/
  app/
    api/bookings/            CRUD de agendamentos
    api/notifications/       inscrição e cancelamento de Web Push
    api/cron/notifications/  ciclo de envio (protegido por CRON_SECRET)
    page.tsx                 única página do app
  components/
    booking/                 componentes de domínio
    ui/                      shadcn — não edite à mão, use o CLI do shadcn
  lib/
    booking-rules.ts         constantes e erros de domínio (SEM dependências)
    booking-service.ts       regras + acesso ao banco
    booking-time.ts          cálculo de horários do formulário
    notification-service.ts  ciclo de Web Push
    cron-auth.ts             validação do CRON_SECRET
    prisma.ts                singleton do Prisma Client
  generated/prisma/          gerado — nunca edite, nunca commite
prisma/
  schema.prisma              fonte da verdade do modelo de dados
  migrations/                histórico aplicado; nunca edite uma já commitada
.github/workflows/           CI, preview, release, cron
```

## Regras de negócio (não altere sem pedir)

- Máximo de **8 horas** por agendamento.
- Máximo de **2 agendamentos simultâneos** por apartamento; ao tentar o terceiro,
  o app oferece substituir o mais antigo.
- Máximo de **4 agendamentos por apartamento a cada 7 dias**
  (`BOOKING_WINDOW_DAYS` / `MAX_APARTMENT_BOOKINGS_PER_WINDOW`), para coibir
  uso diário abusivo das máquinas.
- Um agendamento é considerado **efetivado** a partir de **1 hora depois do
  início** (`EFFECTUATION_DELAY_MINUTES`) — ou assim que termina, mesmo que
  tenha durado menos que isso. A partir daí o morador não pode mais apagá-lo.
  A contagem é depois do início, e não antes, para que dê tempo de desistir de
  um horário que não vai usar, inclusive atrasando alguns minutos. A cláusula
  do término não é detalhe: sem ela, uma reserva curta poderia ser usada e
  apagada em seguida, devolvendo a vaga no limite semanal de graça.
- **3 máquinas** (1, 2, 3); a mesma máquina não pode ter horários sobrepostos.
- Agendamentos encerrados há mais de **7 dias** (`BOOKING_RETENTION_DAYS`) são
  removidos automaticamente. Esse prazo é igual ao da janela do limite
  semanal de propósito: se a limpeza apagasse os registros antes, o limite
  semanal deixaria de enxergar o uso passado.
- Notificações são enviadas **15 minutos** antes do início e do término
  (`NOTIFICATION_LEAD_MINUTES`), e ainda são entregues, atrasadas e com o texto
  ajustado, por até **1 hora** depois do momento previsto
  (`NOTIFICATION_GRACE_MINUTES`) — o agendador não é pontual, ver
  `docs/DEPLOY.md`.
- **As notificações estão desligadas desde 19/08/2026**
  (`NOTIFICATIONS_ENABLED`, em `src/lib/notifications-config.ts`). O cron
  chamava o ciclo a cada 5 minutos e cada chamada consultava o banco; como o
  autosuspend do Neon no plano free é fixo em 5 minutos, o compute nunca dormia,
  a cota mensal acabava no dia 17 e o app saía do ar. Enquanto a flag estiver
  desligada, **nenhum caminho de notificação pode tocar o banco** — é isso que
  os testes `... com as notificações desligadas` protegem, e não o mero "não
  enviou". Como religar está em `docs/DEPLOY.md`.

Esses números vivem em `src/lib/booking-rules.ts` e
`src/lib/notifications-config.ts`. Mudou o número, mude no arquivo — nunca
espalhe o literal pelo código.

## Convenções que este repositório segue

- **Português** em textos de UI, mensagens de erro, comentários, changesets e
  commits. Nomes de código em inglês.
- `src/lib/booking-rules.ts` não pode importar Prisma nem React: ele é
  importado por componentes client, e puxar o Prisma para lá levaria o client
  inteiro para o bundle do navegador.
- Rotas de API capturam `unknown` e usam os helpers de `src/lib/api-errors.ts`.
  Nunca `catch (error: any)` — o ESLint reprova.
- A regra `react-hooks/set-state-in-effect` está ativa: **não chame `setState`
  de forma síncrona dentro de `useEffect`**. Para estado que vem do navegador
  (`localStorage`, `sessionStorage`, `Notification.permission`) use
  `useSyncExternalStore` — veja `src/lib/apartment-storage.ts` como modelo.
- Componentes em `src/components/ui/` vêm do shadcn. Para adicionar outro:
  `npx shadcn@latest add <componente>`.

## Fluxo de trabalho

```
usuário cria a branch  →  pede a implementação
   →  você implementa, testa, cria o changeset
   →  você commita e abre o pull request
   →  CI valida (qualidade, migrations, changeset, preview isolado)
   →  USUÁRIO aceita o merge          ← único passo manual dele
   →  release automático: versão, tag, migrations, produção
```

O ciclo completo está descrito nas skills em `.claude/skills/`. Comece por
`.claude/skills/desenvolver-feature/SKILL.md`.

Regras que valem sempre:

1. **Toda mudança precisa de um changeset.** O CI reprova o pull request sem um.
2. **Toda mudança de comportamento precisa de teste.** Bug corrigido sem teste
   de regressão volta.
3. **`npm run verify` tem que passar** antes de você considerar a tarefa pronta.
4. **Migration é sempre aditiva.** As migrations rodam antes do deploy; um
   `DROP COLUMN` derruba a versão que ainda está no ar. Ver `docs/DEPLOY.md`.
5. **Você commita e abre o pull request; o usuário só aprova o merge.** Depois
   que `npm run verify` passar, faça o commit sem perguntar. O único passo
   manual dele é aceitar o pull request. Nunca commite direto na `main`.

## Ambientes

| Ambiente   | Banco                       | Deploy                                  |
| ---------- | --------------------------- | --------------------------------------- |
| Local      | branch pessoal no Neon      | `npm run dev`                           |
| Preview    | branch `preview/pr-N` no Neon, criada pelo CI | GitHub Actions em cada PR |
| Produção   | branch de produção do Neon  | GitHub Actions ao mergear na `main`      |

O auto-deploy da Vercel por push está **desligado** (`vercel.json` →
`git.deploymentEnabled: false`). Nada chega à produção sem passar pelo CI.

## Variáveis de ambiente

| Nome                           | Onde                    | Para quê                                  |
| ------------------------------ | ----------------------- | ----------------------------------------- |
| `DATABASE_URL`                 | Vercel (todos), `.env.local` | Conexão do app (pooled)              |
| `DATABASE_URL_UNPOOLED`        | secrets do CI, `.env.local` | Migrations (conexão direta — o pooler quebra migrations) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel (todos)          | Chave pública Web Push (vai para o client) |
| `VAPID_PRIVATE_KEY`            | Vercel (todos)          | Assinatura das notificações                |
| `VAPID_SUBJECT`                | Vercel (opcional)       | `mailto:` exigido pelo VAPID               |
| `CRON_SECRET`                  | Vercel + secret do repo | Protege `/api/cron/notifications`          |
| `NEXT_PUBLIC_NOTIFICATIONS_ENABLED` | Vercel (nenhum ambiente hoje) | `"true"` liga as notificações; ausente = desligado |

Sem as chaves VAPID o app funciona normalmente: as notificações apenas ficam
indisponíveis, sem quebrar build nem runtime. Isso é proposital.
