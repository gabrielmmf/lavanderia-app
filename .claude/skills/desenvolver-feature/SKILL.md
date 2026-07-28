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
  `src/lib/booking-service.ts`, e precisa de teste. Toda regra nova ou
  alterada segue o checklist da seção 1.1.
- **É só interface?** → `src/components/booking/`. Componentes de
  `src/components/ui/` são do shadcn e não se editam à mão.
- **Mexe em notificações?** → `src/lib/notification-service.ts` e
  `src/lib/notifications-config.ts`.

## 1.1 Toda regra de negócio nova (limite, prazo, contagem)

Regra de negócio aqui significa qualquer número que muda o que o morador pode
ou não fazer: limite de agendamentos, antecedência mínima, duração máxima,
janela de retenção etc. Ao adicionar ou alterar uma:

1. **O número mora em `src/lib/booking-rules.ts`, com um comentário
   explicando o *porquê*.** Nunca espalhe o literal por outros arquivos —
   quem for mudar o valor depois deve precisar editar um único lugar.
2. **Teste o número em `booking-rules.test.ts`** (valor e comportamento no
   limite exato) **e o efeito dele em `booking-service.test.ts`** (o que
   acontece quando a regra é violada).
3. **Atualize `RulesDialog.tsx`** (`src/components/booking/RulesDialog.tsx`,
   o "componente de regras" que o morador abre pelo ícone de informação) —
   toda regra que afeta o morador tem que estar documentada ali, na mesma
   seção de "Como funciona a Lavanderia". Importe a constante de
   `booking-rules.ts` e interpole no texto — não escreva o número de novo.
   Uma regra sem entrada aqui é uma regra que o morador só descobre
   apanhando.
4. **Mensagens de erro devem ser específicas.** Diga o que a pessoa fez, qual
   é o limite, e — quando der para calcular — quando ela poderá tentar de
   novo. "Limite atingido" sozinho obriga o morador a adivinhar; "você já tem
   4 agendamentos nos últimos 7 dias, poderá agendar de novo a partir de
   quinta-feira às 14h" não.
5. **Atualize a tabela de regras de negócio no `CLAUDE.md`** se a regra for
   grande o suficiente para estar listada lá.

### Antes de implementar um limite anti-abuso, verifique a premissa de dados

Um limite baseado em "contar registros dos últimos N dias" só funciona se os
registros de fato sobrevivem N dias no banco. Neste app,
`deleteExpiredBookings` apaga agendamentos um tempo depois de terminarem — se
esse prazo for menor que a janela do novo limite, o limite vira, na prática,
outra coisa (geralmente um teto de quantos registros o apartamento pode ter
"em mãos" ao mesmo tempo, não um limite de uso ao longo do tempo). Isso já
aconteceu ao desenhar o limite semanal de agendamentos: foi preciso alinhar
`BOOKING_RETENTION_DAYS` a `BOOKING_WINDOW_DAYS` para o limite ser real.

Antes de implementar uma regra desse tipo:

- Desenhe no papel um cenário de abuso ao longo de vários dias, não só uma
  chamada isolada da API. Pergunte "o que impede a pessoa de repetir isso
  todo santo dia?", não só "o que impede essa chamada específica?".
- Se a correção depender de mudar uma regra de negócio já documentada no
  `CLAUDE.md` (como a janela de retenção), **pergunte ao usuário antes** — a
  seção "Regras de negócio" do `CLAUDE.md` existe justamente para isso.
- Prefira a solução mais simples que resolve o problema de verdade (mudar
  uma constante) a uma mais robusta, porém mais pesada (tabela nova,
  migration) — mas ofereça a robusta como alternativa se a simples tiver
  efeitos colaterais que o usuário talvez não queira (aqui, o calendário
  passou a reter e mostrar agendamentos por mais tempo).
- Nunca implemente sua primeira ideia sem avaliar se ela resolve o problema
  de abuso relatado ponta a ponta. Se encontrar uma solução melhor que a
  pedida, proponha — quem pede a funcionalidade nem sempre enxerga a
  interação com uma regra já existente (aqui, a limpeza automática).

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
