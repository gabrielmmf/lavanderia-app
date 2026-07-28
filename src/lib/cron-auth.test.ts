import { afterEach, describe, expect, it } from "vitest"
import { isAuthorizedCronRequest } from "./cron-auth"

const ORIGINAL_SECRET = process.env.CRON_SECRET

function requestWith(authorization?: string) {
  return new Request("https://example.com/api/cron/notifications", {
    headers: authorization ? { authorization } : {},
  })
}

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET
})

describe("isAuthorizedCronRequest", () => {
  it("aceita o segredo correto", () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(isAuthorizedCronRequest(requestWith("Bearer s3cr3t"))).toBe(true)
  })

  it("recusa segredo errado do mesmo tamanho", () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(isAuthorizedCronRequest(requestWith("Bearer s3cr3T"))).toBe(false)
  })

  it("recusa segredo de tamanho diferente", () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(isAuthorizedCronRequest(requestWith("Bearer s3cr3tt"))).toBe(false)
  })

  it("recusa quando não há header", () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(isAuthorizedCronRequest(requestWith())).toBe(false)
  })

  it("recusa esquema diferente de Bearer", () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(isAuthorizedCronRequest(requestWith("Basic s3cr3t"))).toBe(false)
  })

  it("falha fechado quando CRON_SECRET não está configurado", () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(requestWith("Bearer qualquer"))).toBe(false)
  })
})
