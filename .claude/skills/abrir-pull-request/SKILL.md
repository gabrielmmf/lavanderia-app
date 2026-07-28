---
name: abrir-pull-request
description: Commita, faz push e abre um pull request do lavanderia-app para a main, com validação prévia e acompanhamento dos checks do CI. Use quando o usuário pedir "abra o PR", "abra o pull request", "manda pra revisão", "sobe isso" ou quiser saber por que os checks estão falhando.
---

# Abrir um pull request

Neste repositório **você commita, faz push e abre o pull request**. O único
passo manual do usuário é aceitar o merge.

## 1. Verificações antes de abrir

Rode na ordem e **não abra o pull request se algo falhar**:

```bash
git branch --show-current          # não pode ser main
git status --short                 # o que ainda falta commitar
npm run verify                     # lint + tipos + testes + build
```

Confirme que existe changeset:

```bash
git fetch origin main
npx changeset status --since=origin/main
```

Se não houver, pare e ofereça criar um (`npm run changeset`) — o CI reprova sem.
Se a mudança realmente não merece versão, use `npx changeset --empty` ou avise
que o pull request precisará da label `skip-changeset`.

Se houver alteração em `prisma/`, confirme que a migration é aditiva (skill
`migracao-banco`) e mencione isso na descrição.

## 2. Commite o que estiver pendente

Se `git status` mostrar mudanças não commitadas, commite-as seguindo a
convenção da seção 8 da skill `desenvolver-feature` (commit convencional em
português, com o trailer `Co-Authored-By`).

Confira antes que nada de `.env*`, `.vercel/`, `node_modules/` ou
`src/generated/` está entrando.

## 3. Push e abertura

```bash
git push -u origin "$(git branch --show-current)"

gh pr create --base main --title "<tipo>: <resumo curto>" --body "$(cat <<'EOF'
## O que muda

<uma ou duas frases, do ponto de vista de quem usa o app>

## Como validar

<passos no preview, ou "coberto pelos testes X e Y">

## Checklist

- [x] `npm run verify` passa localmente
- [x] Testes cobrindo a mudança
- [x] Changeset incluído
- [ ] Migration aditiva (marque só se houver migration)

## Migrations

<"Nenhuma" ou a descrição do que a migration faz e por que é aditiva>
EOF
)"
```

Título no padrão de commit convencional, em português:
`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

## 4. Acompanhe os checks

```bash
gh pr checks --watch
```

O que precisa ficar verde:

| Check                    | O que valida                                              |
| ------------------------ | --------------------------------------------------------- |
| `Qualidade / verify`     | lint, tipos, testes e build                                |
| `Qualidade / migrations` | migrations aplicam do zero e batem com o `schema.prisma`   |
| `Changeset`              | existe changeset no pull request                           |
| `Preview`                | branch no Neon criada, migrations aplicadas, deploy no ar  |

Quando o `Preview` passa, o bot comenta a URL do preview no pull request. Passe
essa URL ao usuário — é onde ele valida na prática, com um banco isolado.

## 5. Se algum check falhar

```bash
gh run list --limit 5
gh run view <id> --log-failed
```

| Falha em                     | Provável causa                                            |
| ---------------------------- | --------------------------------------------------------- |
| `verify`                     | Algo que `npm run verify` pegaria — rode local            |
| `migrations`                 | Drift entre schema e migrations → skill `migracao-banco`  |
| `Changeset`                  | Falta o arquivo em `.changeset/`                          |
| `Preview` no passo do Neon   | `NEON_API_KEY` / `NEON_PROJECT_ID` → skill `diagnosticar-deploy` |
| `Preview` no smoke test      | App subiu mas não responde → veja `npx vercel logs <url>` |

Corrija, commite a correção e faça push — os checks rodam de novo sozinhos. Não
peça ao usuário para commitar; isso é seu.

## 6. Entregue ao usuário

Quando os checks estiverem verdes, relate:

- a URL do pull request;
- a URL do preview (o bot comenta no PR) — é onde ele valida na prática, com
  banco isolado;
- o que vai acontecer no merge (versão que será gerada, se há migration).

E então **pare**. Aceitar o pull request é decisão dele. Não faça merge, não use
`gh pr merge`, mesmo que todos os checks estejam verdes.

## 7. O que acontece no merge

Ao mergear na `main`, o `release.yml` executa, nesta ordem:

1. Qualidade (os mesmos checks do pull request, de novo)
2. Consome os changesets → nova versão em `package.json` + `CHANGELOG.md`
3. Cria a tag `vX.Y.Z` e a GitHub Release
4. Aplica as migrations pendentes no banco de produção
5. Promove o deploy de produção na Vercel
6. Smoke test na produção

Se qualquer passo falhar, os seguintes não rodam. Explique isso ao usuário
quando ele perguntar "já está no ar?" — e confira:

```bash
gh run list --workflow=release.yml --limit 3
```
