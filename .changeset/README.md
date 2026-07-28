# Changesets

Esta pasta guarda os **changesets**: arquivos markdown que descrevem o que mudou
num pull request e qual incremento de versão isso representa.

## Como criar

```bash
npm run changeset
```

O CLI pergunta o tipo de mudança e o resumo, e grava um arquivo aqui.
Você também pode criar o arquivo à mão:

```markdown
---
"lavanderia-app": minor
---

Adiciona notificações Web Push para início e término das reservas.
```

## Qual tipo escolher

| Tipo    | Quando usar                                                              |
| ------- | ------------------------------------------------------------------------ |
| `patch` | Correção de bug, ajuste de texto, refatoração sem mudança de comportamento |
| `minor` | Nova funcionalidade visível para o morador                                |
| `major` | Mudança incompatível: dado removido, regra de negócio alterada, API quebrada |

## Mudanças que não merecem versão

Alterações puramente internas (CI, README, configuração de editor) podem usar um
changeset vazio, que satisfaz o CI sem gerar bump de versão:

```bash
npx changeset --empty
```

## O que acontece depois

Ao mergear o pull request na `main`, o workflow `release.yml`:

1. consome todos os changesets pendentes,
2. calcula a nova versão e atualiza `package.json` e `CHANGELOG.md`,
3. cria a tag `vX.Y.Z` e a GitHub Release,
4. aplica as migrations pendentes no banco de produção,
5. promove o deploy de produção na Vercel.

Você não precisa rodar `changeset version` manualmente.
