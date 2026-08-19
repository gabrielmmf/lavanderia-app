import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/lib/test-utils/prisma-mock"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const { POST } = await import("./route")

function post(body: unknown) {
  return new Request("https://example.com/api/notifications/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  resetPrismaMock()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/notifications/unsubscribe", () => {
  it("remove a inscrição do endpoint informado", async () => {
    prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

    const response = await POST(post({ endpoint: "https://push.example/abc" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, removed: 1 })
    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/abc" },
    })
  })

  it("recusa quando falta o endpoint", async () => {
    const response = await POST(post({}))

    expect(response.status).toBe(400)
    expect(prismaMock.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })
})

/**
 * Regressão da queda por cota do Neon (19/08/2026). Apagar uma linha custa o
 * mesmo que gravar uma: acorda o compute por 5 minutos. Com as notificações
 * desligadas as inscrições antigas ficam onde estão — são inertes, e limpá-las
 * custaria justamente a cota que desligar tudo pretende poupar.
 */
describe("POST /api/notifications/unsubscribe com as notificações desligadas", () => {
  it("responde 503 sem apagar nada", async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED = "false"
    const { POST: postDesligado } = await import("./route")

    const response = await postDesligado(post({ endpoint: "https://push.example/abc" }))

    expect(response.status).toBe(503)
    expect(prismaMock.pushSubscription.deleteMany).not.toHaveBeenCalled()

    process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED = "true"
  })
})
