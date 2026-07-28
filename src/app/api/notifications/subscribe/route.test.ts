import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/lib/test-utils/prisma-mock"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const { POST } = await import("./route")

function post(body: unknown) {
  return new Request("https://example.com/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  apartmentNumber: "101",
  subscription: {
    endpoint: "https://push.example/abc",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
  },
}

beforeEach(() => {
  resetPrismaMock()
  prismaMock.pushSubscription.upsert.mockResolvedValue({ id: "s1" })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/notifications/subscribe", () => {
  it("registra a inscrição", async () => {
    const response = await POST(post(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/abc" },
      update: { apartmentNumber: "101", p256dh: "p256dh-key", auth: "auth-key" },
      create: {
        apartmentNumber: "101",
        endpoint: "https://push.example/abc",
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
    })
  })

  it("normaliza o apartamento removendo espaços", async () => {
    await POST(post({ ...validBody, apartmentNumber: "  101  " }))

    expect(prismaMock.pushSubscription.upsert.mock.calls[0][0].create.apartmentNumber).toBe("101")
  })

  it.each([
    ["sem apartamento", { ...validBody, apartmentNumber: "" }],
    ["apartamento só com espaços", { ...validBody, apartmentNumber: "   " }],
    ["sem subscription", { apartmentNumber: "101" }],
    ["sem endpoint", { ...validBody, subscription: { keys: validBody.subscription.keys } }],
    [
      "sem chaves",
      { ...validBody, subscription: { endpoint: "https://push.example/abc" } },
    ],
    [
      "apartamento não-string",
      { ...validBody, apartmentNumber: 101 },
    ],
  ])("responde 400 %s", async (_label, body) => {
    const response = await POST(post(body))

    expect(response.status).toBe(400)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it("responde 500 quando o banco falha", async () => {
    prismaMock.pushSubscription.upsert.mockRejectedValue(new Error("db down"))

    const response = await POST(post(validBody))
    expect(response.status).toBe(500)
  })
})
