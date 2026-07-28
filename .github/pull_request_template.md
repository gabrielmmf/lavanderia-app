## O que muda

<!-- Descreva em uma ou duas frases, do ponto de vista de quem usa o app. -->

## Como validar

<!-- Passos no preview, ou "coberto pelos testes X e Y". -->

## Checklist

- [ ] `npm run verify` passa localmente (lint, tipos, testes, build)
- [ ] Há testes cobrindo o comportamento novo ou o bug corrigido
- [ ] Há um changeset (`npm run changeset`) descrevendo a mudança
- [ ] Se mexi no `schema.prisma`, gerei a migration (`npm run db:migrate`) e ela é aditiva
- [ ] Se adicionei variável de ambiente, ela está configurada na Vercel nos ambientes necessários

## Migrations

<!-- Marque uma opção -->

- [ ] Não há migration neste pull request
- [ ] Há migration e ela é **aditiva** (só adiciona coluna/tabela, ou torna coluna opcional)
- [ ] Há migration **destrutiva** — descreva abaixo o plano em duas etapas

<!--
Migration destrutiva (DROP COLUMN, RENAME, NOT NULL em coluna existente) não pode
ir num único pull request: as migrations rodam antes do deploy, então o código
antigo continua no ar por alguns segundos com o schema já alterado.
Ver docs/DEPLOY.md.
-->
