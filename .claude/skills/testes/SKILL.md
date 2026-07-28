---
name: testes
description: Como escrever e rodar testes no lavanderia-app com Vitest e Testing Library. Use ao criar testes para código novo, adicionar teste de regressão para um bug, investigar teste falhando, ou quando precisar mockar Prisma, web-push ou APIs do navegador.
---

# Testes

Vitest + jsdom + Testing Library. Configuração em `vitest.config.ts`, setup
global em `vitest.setup.ts`.

```bash
npm test                                  # tudo
npm run test:watch                        # watch
npx vitest run src/lib/booking-time.test.ts   # um arquivo
npx vitest run -t "recusa agendamento no passado"  # um teste
npm run test:coverage                     # cobertura de src/lib e src/app/api
```

Arquivos de teste ficam **ao lado do código**: `booking-service.ts` →
`booking-service.test.ts`.

## O que testar

| Camada                          | Testar?                                             |
| ------------------------------- | --------------------------------------------------- |
| `src/lib/*` (lógica de negócio) | **Sempre**, com casos de borda                      |
| `src/app/api/*/route.ts`        | **Sim** — status codes e validação de entrada       |
| `src/components/booking/*`      | Quando houver lógica; interação, não markup         |
| `src/components/ui/*`           | Não — é shadcn                                      |
| `src/generated/*`               | Não — é gerado                                      |

Teste **comportamento**, não implementação. `expect(resultado).toBe(x)` vale
mais do que `expect(funcaoInterna).toHaveBeenCalled()`.

## Receita: lógica pura

Sem mock. Injete o tempo em vez de depender do relógio:

```ts
import { describe, expect, it } from "vitest"
import { getDefaultStart } from "./booking-time"

it("sugere a abertura quando o dia ainda não começou", () => {
  const start = getDefaultStart(new Date(2026, 6, 27, 6, 12))
  expect(start.getHours()).toBe(8)
})
```

Funções que precisam de "agora" recebem `now: Date = new Date()` como último
parâmetro — é o padrão do repositório (`validateBookingInput`,
`runNotificationCycle`, `getDefaultStart`).

## Receita: código que usa Prisma

Use o mock compartilhado. O `vi.mock` é içado para o topo do arquivo, então o
módulo sob teste precisa ser importado com `await import` **depois** dele:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "./test-utils/prisma-mock"

vi.mock("./prisma", () => ({ prisma: prismaMock }))

const { createBooking } = await import("./booking-service")

beforeEach(() => {
  resetPrismaMock()          // devolve retornos neutros ([], null, 0)
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 27, 10, 0))
})

it("detecta sobreposição na mesma máquina", async () => {
  prismaMock.booking.findFirst.mockResolvedValue({ id: "existente" })
  await expect(createBooking(dados)).rejects.toThrow(/já está agendada/)
})
```

Quando o código chama o mesmo método mais de uma vez com significados
diferentes, encadeie `mockResolvedValueOnce` na ordem das chamadas:

```ts
prismaMock.booking.findFirst
  .mockResolvedValueOnce(null)              // 1ª chamada: conflito de horário
  .mockResolvedValueOnce({ id: "antigo" })  // 2ª chamada: mais antigo do apto
```

Precisou de um método do Prisma que não está em `prisma-mock.ts`? Adicione lá,
com `vi.fn()`, e um retorno neutro em `resetPrismaMock`.

## Receita: rota de API

Chame o handler exportado com um `Request` real — sem servidor, sem supertest:

```ts
const { POST } = await import("./route")

const response = await POST(
  new Request("https://example.com/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  })
)

expect(response.status).toBe(400)
await expect(response.json()).resolves.toEqual({ error: "..." })
```

Cubra sempre: caminho feliz, entrada inválida (400), não autorizado (401 onde
existir) e falha do banco (500).

## Receita: módulo com estado interno

`notification-service.ts` guarda em memória se o VAPID já foi configurado. Para
testar os dois caminhos, reimporte o módulo:

```ts
async function importService() {
  vi.resetModules()
  return import("./notification-service")
}
```

## Receita: mock do web-push

```ts
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}))
```

Falhas do push são objetos com `statusCode`, não `Error`:
`sendNotification.mockRejectedValue({ statusCode: 410 })`.

## Variáveis de ambiente nos testes

`vitest.setup.ts` já define valores previsíveis para `CRON_SECRET`,
`DATABASE_URL` e as chaves VAPID. Se um teste precisar mudar uma delas, **guarde
e restaure**:

```ts
const ORIGINAL = process.env.CRON_SECRET
afterEach(() => { process.env.CRON_SECRET = ORIGINAL })
```

## Ruído no output

Testes que exercitam caminho de erro logam de propósito. Silencie no
`beforeEach` para manter a saída legível:

```ts
vi.spyOn(console, "error").mockImplementation(() => {})
```

## Checklist antes de terminar

- [ ] Caminho feliz coberto
- [ ] Casos de borda: vazio, limite exato, acima do limite, passado/futuro
- [ ] Caminhos de erro produzem o status ou a exceção certos
- [ ] Nenhum teste depende do relógio real nem da ordem de execução
- [ ] `npm test` passa inteiro, não só o arquivo novo
