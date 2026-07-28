import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/lib/test-utils/prisma-mock"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const { GET } = await import("./route")

function request(authorization?: string) {
  return new Request("https://example.com/api/health", {
    headers: authorization ? { authorization } : {},
  })
}

const ORIGINAIS = {
  secret: process.env.CRON_SECRET,
  url: process.env.DATABASE_URL,
}

beforeEach(() => {
  resetPrismaMock()
  process.env.CRON_SECRET = "s3cr3t"
  process.env.DATABASE_URL =
    "postgresql://u:p@ep-soft-wildflower-acn1xtb4-pooler.sa-east-1.aws.neon.tech/neondb"
  prismaMock.pushSubscription.count.mockResolvedValue(0)
  prismaMock.booking.count.mockResolvedValue(0)
})

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAIS.secret
  process.env.DATABASE_URL = ORIGINAIS.url
})

describe("GET /api/health", () => {
  it("responde 200 quando o banco responde e o schema está atualizado", async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      database: { reachable: true, schemaUpToDate: true },
    })
  })

  it("não expõe detalhes de infraestrutura sem autenticação", async () => {
    const body = await (await GET(request())).json()

    expect(body.database.endpoint).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain("neon.tech")
  })

  it("expõe o endpoint do Neon quando autenticado", async () => {
    const body = await (await GET(request("Bearer s3cr3t"))).json()

    expect(body.database.endpoint).toBe("ep-soft-wildflower-acn1xtb4")
  })

  it("responde 503 quando o banco está inacessível", async () => {
    prismaMock.pushSubscription.count.mockRejectedValue(new Error("sem conexão"))
    prismaMock.booking.count.mockRejectedValue(new Error("sem conexão"))

    const response = await GET(request())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      database: { reachable: false, schemaUpToDate: false },
    })
  })

  it("distingue banco acessível de schema desatualizado", async () => {
    // Cenário real: o deploy aponta para um banco sem a migration aplicada.
    prismaMock.pushSubscription.count.mockRejectedValue(new Error('relation "PushSubscription" does not exist'))

    const response = await GET(request())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      database: { reachable: true, schemaUpToDate: false },
    })
  })
})
