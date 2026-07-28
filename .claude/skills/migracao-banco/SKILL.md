---
name: migracao-banco
description: Como alterar o modelo de dados do lavanderia-app com Prisma e Neon sem quebrar produção. Use sempre que precisar adicionar/remover/renomear campo ou tabela, criar índice, mexer em prisma/schema.prisma ou investigar erro de migration. Explica a regra expand/contract, o check de drift do CI e o branching do Neon.
---

# Alterar o banco de dados

## A regra que governa tudo: migrations são aditivas

No `release.yml` a ordem é: **migrations primeiro, deploy depois**. Entre um e
outro existe uma janela de segundos em que o **código antigo está no ar com o
schema novo**.

Consequência direta:

| Operação                                    | Pode ir num único pull request? |
| ------------------------------------------- | ------------------------------- |
| `ADD COLUMN` com default ou nullable        | ✅ Sim                          |
| `CREATE TABLE`                              | ✅ Sim                          |
| `CREATE INDEX`                              | ✅ Sim                          |
| Tornar coluna opcional                      | ✅ Sim                          |
| `ADD COLUMN NOT NULL` sem default           | ❌ Não — quebra insert antigo   |
| `DROP COLUMN`                               | ❌ Não — código antigo ainda lê |
| `RENAME COLUMN`                             | ❌ Não — é drop + add           |
| Mudar tipo de coluna                        | ❌ Não                          |

Para as linhas ❌, use **duas releases** (expand/contract):

1. **Expand** — adicione o novo campo, faça o código escrever nos dois e ler do
   novo com fallback. Mergeie e deixe ir para produção.
2. **Contract** — num pull request seguinte, remova o campo antigo e o fallback.

Se o usuário pedir uma mudança destrutiva num pull request só, **explique o
risco e proponha as duas etapas** antes de implementar.

## Fluxo normal

### 1. Edite o `schema.prisma`

`prisma/schema.prisma` é a fonte da verdade. **Nunca escreva o SQL da migration
à mão** — foi assim que a tabela `PushSubscription` acabou existindo nas
migrations mas não no schema, e o build quebrou.

```prisma
model Booking {
  // ...
  /// Comentário com três barras vira documentação no client gerado.
  startNotified Boolean @default(false)
}
```

### 2. Gere a migration

```bash
npm run db:migrate -- --name descricao_curta_em_snake_case
```

Isso cria `prisma/migrations/<timestamp>_descricao/migration.sql`, aplica no seu
banco local e regenera o client.

Precisa de um `DATABASE_URL_UNPOOLED` apontando para um banco de
desenvolvimento — idealmente sua própria branch do Neon, nunca produção. Ver
"Trabalhar com branches do Neon" abaixo.

### 3. Confira o SQL gerado

Abra o arquivo e leia. Procure por:

- `DROP`, `RENAME`, `ALTER COLUMN ... TYPE` → é destrutivo, volte para a regra
  expand/contract;
- `NOT NULL` sem `DEFAULT` numa tabela que já tem linhas → vai falhar em
  produção mesmo tendo passado num banco vazio;
- índice novo em tabela grande → aqui o volume é pequeno, não é problema.

### 4. Verifique que não há drift

O CI faz isso, mas verifique antes de abrir o pull request:

```bash
npm run db:validate    # schema é sintaticamente válido
npm run db:status      # o que já foi aplicado
```

O check completo de drift precisa de um Postgres vazio; ele roda no job
`migrations` do `quality.yml`. Se falhar lá, a mensagem é:

> `schema.prisma diverge das migrations`

O que significa: o schema descreve algo que nenhuma migration cria (ou
vice-versa). Corrija gerando a migration que falta, nunca editando uma
migration já commitada.

### 5. Nunca edite uma migration já commitada

Migrations já aplicadas em produção estão registradas na tabela
`_prisma_migrations` com um checksum. Editar o arquivo faz o `migrate deploy`
falhar em produção. Se errou, **crie uma nova migration corrigindo**.

## Trabalhar com branches do Neon

O Neon copia o banco instantaneamente, e é assim que testamos migrations sem
risco.

- **No CI:** cada pull request ganha `preview/pr-N` automaticamente
  (`preview.yml`), com as migrations do PR já aplicadas. A branch é apagada no
  fechamento do PR (`preview-cleanup.yml`).
- **Localmente:** crie sua própria branch no console do Neon ou pela CLI, e
  aponte `DATABASE_URL` / `DATABASE_URL_UNPOOLED` do seu `.env.local` para ela.

```bash
# .env.local (nunca commitado)
DATABASE_URL="postgresql://...-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://....sa-east-1.aws.neon.tech/neondb?sslmode=require"
```

**Nunca aponte o `.env.local` para a branch de produção.** `npm run db:migrate`
altera o banco em que está conectado.

## Pooled vs unpooled

| Variável                | Host                | Para quê                          |
| ----------------------- | ------------------- | --------------------------------- |
| `DATABASE_URL`          | `...-pooler...`     | Runtime do app (serverless)       |
| `DATABASE_URL_UNPOOLED` | sem `-pooler`       | `prisma migrate`, `prisma studio` |

`prisma.config.ts` já prefere `DATABASE_URL_UNPOOLED` e cai para `DATABASE_URL`
se ela não existir. Migrations pelo pooler falham em advisory lock — foi o que
impediu a migration `add_web_push` de ser aplicada por engano em produção.

## Onde as migrations rodam

| Ambiente | Quem aplica                             | Quando                    |
| -------- | --------------------------------------- | ------------------------- |
| Local    | você, com `npm run db:migrate`          | ao desenvolver            |
| Preview  | `preview.yml`, na branch do PR          | a cada push no PR         |
| Produção | `release.yml`, antes do deploy          | ao mergear na `main`      |

O `vercel-build` **não** roda migrations. Isso é deliberado: antes ele rodava, e
todo build de preview migrava o banco de produção.
