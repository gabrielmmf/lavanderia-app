import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "@/lib/test-utils/prisma-mock"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

// Mockado para manter o teste sobre a rota, não sobre o web-push: aqui só
// interessa que o resultado da checagem chegue à resposta.
const ensureVapidConfigured = vi.fn()
vi.mock("@/lib/notification-service", () => ({
  ensureVapidConfigured: () => ensureVapidConfigured(),
}))

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
  ensureVapidConfigured.mockReset().mockReturnValue(true)
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

  it("informa que as notificações estão ligadas e configuradas", async () => {
    const body = await (await GET(request())).json()

    expect(body.notifications).toEqual({ enabled: true, configured: true })
  })

  /**
   * O contrário do que acontecia em produção: a chave VAPID inválida não
   * aparecia em lugar nenhum, e o problema só era percebido por um morador
   * clicando no botão. Sem VAPID o app segue íntegro (`ok: true`) — o estado
   * é informativo, não um motivo para reprovar o deploy.
   */
  it("reporta notificações desligadas sem derrubar o health check", async () => {
    ensureVapidConfigured.mockReturnValue(false)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      notifications: { configured: false },
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
