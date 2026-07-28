import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations do Prisma NÃO devem passar pelo pooler do Neon (PgBouncer):
 * elas usam advisory locks e DDL em sessão, que o pooler em modo transaction
 * não suporta. Por isso preferimos sempre a conexão direta (unpooled).
 *
 * DATABASE_URL_UNPOOLED -> conexão direta, usada por `prisma migrate`.
 * DATABASE_URL          -> conexão via pooler, usada pelo app em runtime.
 */
const migrationUrl =
  process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
    // Banco descartável usado por `prisma migrate diff` para replayar as
    // migrations e comparar com o schema. No Prisma 7 isso é configuração,
    // não mais a flag `--shadow-database-url`. Só o CI define esta variável.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
