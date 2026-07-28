import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "./test-utils/prisma-mock"
import { NOTIFICATION_LEAD_MINUTES } from "./notifications-config"

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()

vi.mock("./prisma", () => ({ prisma: prismaMock }))
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}))

const NOW = new Date(2026, 6, 27, 10, 0)

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    apartmentNumber: "101",
    machineNumber: 2,
    startTime: new Date(2026, 6, 27, 10, 10),
    endTime: new Date(2026, 6, 27, 12, 0),
    startNotified: false,
    endNotified: false,
    ...overrides,
  }
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    apartmentNumber: "101",
    endpoint: "https://push.example/abc",
    p256dh: "p256dh-key",
    auth: "auth-key",
    createdAt: NOW,
    ...overrides,
  }
}

/** Reimporta o módulo para zerar o cache interno de configuração do VAPID. */
async function importService() {
  vi.resetModules()
  return import("./notification-service")
}

beforeEach(() => {
  resetPrismaMock()
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 })
  setVapidDetails.mockReset()
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key"
  process.env.VAPID_PRIVATE_KEY = "private-key"
  // Os caminhos de erro logam de propósito; silencia para manter a saída limpa.
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("ensureVapidConfigured", () => {
  it("retorna false e não configura quando faltam chaves", async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const { ensureVapidConfigured } = await importService()

    expect(ensureVapidConfigured()).toBe(false)
    expect(setVapidDetails).not.toHaveBeenCalled()
  })

  it("retorna false quando o web-push rejeita as chaves", async () => {
    setVapidDetails.mockImplementation(() => {
      throw new Error("chave inválida")
    })
    const { ensureVapidConfigured } = await importService()

    expect(ensureVapidConfigured()).toBe(false)
  })

  it("configura apenas uma vez", async () => {
    const { ensureVapidConfigured } = await importService()

    expect(ensureVapidConfigured()).toBe(true)
    expect(ensureVapidConfigured()).toBe(true)
    expect(setVapidDetails).toHaveBeenCalledOnce()
  })
})

describe("runNotificationCycle", () => {
  it("não envia nada quando o VAPID não está configurado", async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const { runNotificationCycle } = await importService()

    await expect(runNotificationCycle(NOW)).resolves.toEqual({
      sent: 0,
      failed: 0,
      pruned: 0,
      bookingsMarked: 0,
    })
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled()
  })

  it("busca apenas agendamentos dentro da janela de antecedência", async () => {
    const { runNotificationCycle } = await importService()
    await runNotificationCycle(NOW)

    const horizon = new Date(NOW.getTime() + NOTIFICATION_LEAD_MINUTES * 60_000)
    const startWhere = prismaMock.booking.findMany.mock.calls[0][0].where
    expect(startWhere).toEqual({
      startNotified: false,
      startTime: { gt: NOW, lte: horizon },
    })
  })

  it("envia e marca o agendamento como notificado", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 })

    const { runNotificationCycle } = await importService()
    const result = await runNotificationCycle(NOW)

    expect(result.sent).toBe(1)
    expect(result.bookingsMarked).toBe(1)
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b1"] } },
      data: { startNotified: true },
    })
  })

  it("usa uma única consulta de inscrições para vários apartamentos", async () => {
    prismaMock.booking.findMany
      .mockResolvedValueOnce([booking(), booking({ id: "b2", apartmentNumber: "202" })])
      .mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([])

    const { runNotificationCycle } = await importService()
    await runNotificationCycle(NOW)

    expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledOnce()
    expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { apartmentNumber: { in: ["101", "202"] } },
    })
  })

  it("NÃO marca como notificado quando o envio falha por erro transitório", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])
    sendNotification.mockRejectedValue({ statusCode: 500 })

    const { runNotificationCycle } = await importService()
    const result = await runNotificationCycle(NOW)

    expect(result.failed).toBe(1)
    expect(result.bookingsMarked).toBe(0)
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled()
  })

  it("remove inscrições expiradas (410) e considera o agendamento tratado", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 })
    sendNotification.mockRejectedValue({ statusCode: 410 })

    const { runNotificationCycle } = await importService()
    const result = await runNotificationCycle(NOW)

    expect(result.pruned).toBe(1)
    expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ["https://push.example/abc"] } },
    })
    expect(result.bookingsMarked).toBe(1)
  })

  it("também remove inscrições que retornam 404", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])
    sendNotification.mockRejectedValue({ statusCode: 404 })

    const { runNotificationCycle } = await importService()
    expect((await runNotificationCycle(NOW)).pruned).toBe(1)
  })

  it("envia para todos os dispositivos do apartamento", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      subscription(),
      subscription({ id: "s2", endpoint: "https://push.example/def" }),
    ])

    const { runNotificationCycle } = await importService()
    expect((await runNotificationCycle(NOW)).sent).toBe(2)
  })

  it("inclui a antecedência configurada no corpo da mensagem", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])

    const { runNotificationCycle } = await importService()
    await runNotificationCycle(NOW)

    const payload = JSON.parse(sendNotification.mock.calls[0][1])
    expect(payload.body).toContain(`${NOTIFICATION_LEAD_MINUTES} minutos`)
    expect(payload.body).toContain("máquina 2")
  })

  it("marca início e término de forma independente", async () => {
    prismaMock.booking.findMany
      .mockResolvedValueOnce([booking({ id: "inicio" })])
      .mockResolvedValueOnce([booking({ id: "fim" })])
    prismaMock.pushSubscription.findMany.mockResolvedValue([subscription()])
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 })

    const { runNotificationCycle } = await importService()
    await runNotificationCycle(NOW)

    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["inicio"] } },
      data: { startNotified: true },
    })
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["fim"] } },
      data: { endNotified: true },
    })
  })

  it("sai cedo quando não há nada na janela", async () => {
    const { runNotificationCycle } = await importService()
    const result = await runNotificationCycle(NOW)

    expect(result).toEqual({ sent: 0, failed: 0, pruned: 0, bookingsMarked: 0 })
    expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled()
  })

  it("não quebra quando o apartamento não tem nenhum dispositivo inscrito", async () => {
    prismaMock.booking.findMany.mockResolvedValueOnce([booking()]).mockResolvedValueOnce([])
    prismaMock.pushSubscription.findMany.mockResolvedValue([])

    const { runNotificationCycle } = await importService()
    const result = await runNotificationCycle(NOW)

    expect(result).toEqual({ sent: 0, failed: 0, pruned: 0, bookingsMarked: 0 })
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
