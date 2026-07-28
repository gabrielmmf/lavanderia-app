---
name: desenvolver-feature
description: Fluxo completo para implementar qualquer funcionalidade ou mudança no lavanderia-app — do planejamento ao pull request pronto para merge. Use sempre que o pedido for "implemente", "adicione", "crie", "mude o comportamento de", "melhore" ou qualquer alteração de código no app. Cobre onde colocar cada tipo de código, testes obrigatórios, changesets, migrations e os portões do CI.
---

# Implementar uma funcionalidade

Este é o fluxo padrão do repositório. Siga na ordem; cada etapa existe porque a
ausência dela já quebrou produção antes.

## 0. Antes de escrever código

Leia `CLAUDE.md` se ainda não leu nesta sessão — ele tem as regras de negócio e
as convenções que o CI cobra.

Confirme em que branch você está:

```bash
git branch --show-current
```

Se estiver na `main`, **pare e avise o usuário**. O fluxo dele é criar a branch
antes de pedir a implementação. Não crie a branch por conta própria a menos que
ele peça.

## 1. Entenda o alcance da mudança

Responda para si mesmo, antes de editar:

- **Muda o modelo de dados?** → precisa de migration → leia a skill
  `migracao-banco` antes de mexer no `schema.prisma`.
- **Muda regra de negócio?** (limites, conflito de horário, validação) →
  o número vai em `src/lib/booking-rules.ts`, a regra em
  `src/lib/booking-service.ts`, e precisa de teste.
- **É só interface?** → `src/components/booking/`. Componentes de
  `src/components/ui/` são do shadcn e não se editam à mão.
- **Mexe em notificações?** → `src/lib/notification-service.ts` e
  `src/lib/notifications-config.ts`.

## 2. Onde colocar cada coisa

| Tipo de código                              | Arquivo                                  |
| ------------------------------------------- | ---------------------------------------- |
| Constante ou erro de domínio                | `src/lib/booking-rules.ts`               |
| Regra de negócio que toca o banco           | `src/lib/booking-service.ts`             |
| Cálculo puro de horário                     | `src/lib/booking-time.ts`                |
| Envio de push                               | `src/lib/notification-service.ts`        |
| Endpoint HTTP                               | `src/app/api/<recurso>/route.ts`         |
| Componente de domínio                       | `src/components/booking/`                |
| Formatação de data para o usuário           | `src/lib/date-utils.ts`                  |

Regras estruturais que o CI e o bundle cobram:

- **`booking-rules.ts` não importa Prisma nem React.** É importado por
  componentes client; puxar Prisma para lá levaria o client inteiro para o
  navegador. Constantes compartilhadas entre servidor e client moram aí.
- **Extraia lógica pura antes de testar.** Se uma regra está enterrada dentro de
  um componente ou de um `route.ts`, mova-a para `src/lib/` e teste lá. Foi
  assim que `getDefaultStart` e `computeEnd` saíram do `BookingForm`.
- **Rotas de API não repetem validação**: elas chamam o serviço e traduzem o
  erro em status HTTP com `src/lib/api-errors.ts`.

## 3. Padrões obrigatórios de React

O ESLint deste projeto reprova o que abaixo está marcado como errado. Não são
preferências — são erros de build.

**Nunca `setState` síncrono dentro de `useEffect`:**

```tsx
// ✗ ERRO react-hooks/set-state-in-effect
useEffect(() => {
  setValor(localStorage.getItem("chave") ?? "")
}, [])
```

Estado que vem do navegador é um *external store*. Use `useSyncExternalStore`,
seguindo `src/lib/apartment-storage.ts`:

```ts
const valor = useSyncExternalStore(
  subscribe,          // registra listener, devolve unsubscribe
  getSnapshot,        // lê o valor atual no client
  getServerSnapshot   // valor durante o SSR — evita mismatch de hidratação
)
```

`setState` dentro de callback assíncrono (`.then()`, `setTimeout`) é permitido —
não causa render em cascata.

**Nunca `catch (error: any)`:**

```ts
// ✓
} catch (error) {
  return errorResponse(error, 400)
}
```

## 4. Escreva os testes

Não é opcional. O padrão do repositório:

- Lógica pura → teste direto, sem mock. Ex.: `src/lib/booking-time.test.ts`
- Lógica que toca o banco → mock do Prisma com
  `src/lib/test-utils/prisma-mock.ts`. Ex.: `src/lib/booking-service.test.ts`
- Rota de API → chame o handler exportado com um `Request` de verdade.
  Ex.: `src/app/api/cron/notifications/route.test.ts`

Detalhes e receitas prontas estão na skill `testes`.

```bash
npm test
```

## 5. Migration, se houver mudança de dados

Leia a skill `migracao-banco`. Em resumo: edite `schema.prisma`, rode
`npm run db:migrate -- --name descricao_curta`, e confirme que a migration é
**aditiva**. O CI compara `schema.prisma` com a pasta `migrations/` e reprova
divergência.

## 6. Changeset

O CI reprova o pull request sem changeset.

```bash
npm run changeset
```

Escolha o tipo:

| Tipo    | Quando                                                        |
| ------- | ------------------------------------------------------------- |
| `patch` | Correção de bug, ajuste de texto, refatoração                  |
| `minor` | Funcionalidade nova visível para o morador                     |
| `major` | Quebra de compatibilidade: dado removido, regra alterada       |

Escreva o resumo **em português, do ponto de vista do morador** — ele vira o
CHANGELOG e a GitHub Release:

```markdown
---
"lavanderia-app": minor
---

Agora dá para escolher a duração da reserva em vez de digitar o horário de fim.
```

Mudança puramente interna (workflow, README): `npx changeset --empty`.

## 7. Valide tudo

```bash
npm run verify
```

Roda lint, tipos, testes e build — exatamente o que o CI roda. Se passar aqui,
passa lá. **Não considere a tarefa pronta antes disso passar.**

## 8. Commite

**Você faz o commit** — não pergunte, não espere. O único passo manual do
usuário neste fluxo é aceitar o pull request no final.

Duas condições antes de commitar, ambas obrigatórias:

- `npm run verify` passou;
- você **não** está na `main` (`git branch --show-current`). Se estiver, pare e
  peça ao usuário para criar a branch — nunca commite direto na `main`.

Confira o que está entrando, para não arrastar lixo:

```bash
git status --porcelain
```

Nada de `.env*`, `.vercel/`, `node_modules/` ou `src/generated/` deve aparecer.
Se aparecer, o `.gitignore` está errado — corrija antes.

```bash
git add -A
git commit -m "$(cat <<'EOF'
<tipo>: <resumo em português, imperativo, minúsculo>

<corpo opcional: o porquê da mudança, não o quê — o diff já mostra o quê>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `perf`.

Alinhe o tipo com o changeset — se o changeset é `minor`, o commit normalmente é
`feat`; se é `patch`, normalmente `fix` ou `chore`.

Um commit por unidade lógica. Se a tarefa misturou coisas independentes (uma
correção de bug e uma refatoração não relacionada), faça commits separados.

## 9. Abra o pull request

Siga a skill `abrir-pull-request`. Depois relate ao usuário:

- o que mudou e por quê;
- quais testes cobrem a mudança;
- se há migration, e se ela é aditiva;
- a URL do pull request e o estado dos checks.

## O que o CI vai cobrar

| Verificação                                | Como reproduzir localmente        |
| ------------------------------------------ | --------------------------------- |
| Lint sem erros                              | `npm run lint`                    |
| Tipos válidos                               | `npm run typecheck`               |
| Testes passando                             | `npm test`                        |
| Build de produção                           | `npm run build`                   |
| Migrations aplicam do zero                  | skill `migracao-banco`            |
| `schema.prisma` bate com `migrations/`      | skill `migracao-banco`            |
| Existe changeset                            | `npx changeset status --since=origin/main` |
| Preview responde na Vercel                  | só no CI                          |
