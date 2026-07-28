# Lavanderia — Studio 733

App de agendamento da lavanderia do prédio. Três máquinas, reserva por faixa de
horário, notificação push antes do início e do término.

Sem login: o morador se identifica pelo número do apartamento, guardado no
navegador.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui · Prisma 7 ·
PostgreSQL no Neon · Vercel · Vitest · Changesets

## Rodando localmente

```bash
npm install
```

Crie um `.env.local` apontando para uma **branch do Neon só sua** — nunca para
produção:

```env
DATABASE_URL="postgresql://...-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://....sa-east-1.aws.neon.tech/neondb?sslmode=require"

# Opcionais: sem elas o app roda, só sem notificações.
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
CRON_SECRET=""
```

Gere as chaves VAPID com `npx web-push generate-vapid-keys`.

```bash
npm run db:deploy   # aplica as migrations na sua branch
npm run dev
```

## Comandos

| Comando               | O que faz                                       |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | servidor de desenvolvimento                     |
| `npm run verify`      | lint + tipos + testes + build (o que o CI roda) |
| `npm test`            | testes                                          |
| `npm run test:watch`  | testes em watch                                 |
| `npm run db:migrate`  | cria migration a partir do `schema.prisma`      |
| `npm run db:status`   | migrations aplicadas vs pendentes               |
| `npm run changeset`   | descreve a mudança para o versionamento         |

## Contribuindo

1. Crie uma branch a partir da `main`.
2. Implemente, com testes.
3. `npm run changeset` — obrigatório, o CI reprova sem.
4. `npm run verify` tem que passar.
5. Commite e abra o pull request. O CI cria uma branch isolada no Neon e um
   preview na Vercel, e comenta a URL.
6. Valide no preview e aceite o pull request.
7. O merge dispara tudo sozinho: versão, tag, GitHub Release, migrations em
   produção e deploy.

Este repositório é desenvolvido com Claude Code. As skills em `.claude/skills/`
automatizam os passos 2 a 5 — o passo manual é aceitar o pull request.

**Migrations são sempre aditivas.** Elas rodam antes do deploy, então um
`DROP COLUMN` derruba a versão que ainda está no ar. Ver
[docs/DEPLOY.md](docs/DEPLOY.md).

## Documentação

| Documento                                    | Sobre                                   |
| -------------------------------------------- | --------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                        | Contexto do projeto para agentes de IA  |
| [docs/DEPLOY.md](docs/DEPLOY.md)              | CI/CD, ambientes e configuração inicial |
| [.changeset/README.md](.changeset/README.md)  | Como funcionam os changesets            |
| `.claude/skills/`                             | Fluxos de trabalho detalhados           |
