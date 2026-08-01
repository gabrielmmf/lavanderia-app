import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runNotificationCycle = vi.fn()

vi.mock("@/lib/notification-service", () => ({ runNotificationCycle }))

const { GET } = await import("./route")

function request(authorization?: string) {
  return new Request("https://example.com/api/cron/notifications", {
    headers: authorization ? { authorization } : {},
  })
}

const ORIGINAL_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = "s3cr3t"
  runNotificationCycle.mockReset().mockResolvedValue({
    vapidConfigured: true,
    sent: 2,
    failed: 0,
    pruned: 1,
    bookingsMarked: 2,
  })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET
})

describe("GET /api/cron/notifications", () => {
  it("responde 401 sem autorização e não executa o ciclo", async () => {
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(runNotificationCycle).not.toHaveBeenCalled()
  })

  it("responde 401 com segredo errado", async () => {
    const response = await GET(request("Bearer errado"))

    expect(response.status).toBe(401)
    expect(runNotificationCycle).not.toHaveBeenCalled()
  })

  it("executa o ciclo e devolve o resumo quando autorizado", async () => {
    const response = await GET(request("Bearer s3cr3t"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      vapidConfigured: true,
      sent: 2,
      failed: 0,
      pruned: 1,
      bookingsMarked: 2,
    })
  })

  // Regressão: sem VAPID o ciclo devolvia `sent: 0` e o endpoint respondia 200,
  // idêntico a uma execução sem nada para enviar. O cron ficou dias verde com
  // as notificações desligadas em produção.
  it("responde 503 quando o VAPID não está configurado", async () => {
    runNotificationCycle.mockResolvedValue({
      vapidConfigured: false,
      sent: 0,
      failed: 0,
      pruned: 0,
      bookingsMarked: 0,
    })

    const response = await GET(request("Bearer s3cr3t"))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      vapidConfigured: false,
    })
  })

  it("responde 500 quando o ciclo lança", async () => {
    runNotificationCycle.mockRejectedValue(new Error("boom"))

    const response = await GET(request("Bearer s3cr3t"))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ detail: "boom" })
  })
})
