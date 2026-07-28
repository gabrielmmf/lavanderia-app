import { describe, expect, it } from "vitest"
import { databaseEndpointId } from "./database-info"

const DIRECT =
  "postgresql://neondb_owner:senha@ep-calm-hat-acoexw57.sa-east-1.aws.neon.tech/neondb?sslmode=require"
const POOLED =
  "postgresql://neondb_owner:senha@ep-calm-hat-acoexw57-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

describe("databaseEndpointId", () => {
  it("extrai o endpoint da conexão direta", () => {
    expect(databaseEndpointId(DIRECT)).toBe("ep-calm-hat-acoexw57")
  })

  it("normaliza a conexão pooled para o mesmo identificador", () => {
    expect(databaseEndpointId(POOLED)).toBe("ep-calm-hat-acoexw57")
  })

  it("distingue branches diferentes", () => {
    const outra =
      "postgresql://u:p@ep-soft-wildflower-acn1xtb4-pooler.sa-east-1.aws.neon.tech/neondb"
    expect(databaseEndpointId(outra)).not.toBe(databaseEndpointId(POOLED))
    expect(databaseEndpointId(outra)).toBe("ep-soft-wildflower-acn1xtb4")
  })

  it("nunca vaza credenciais", () => {
    const id = databaseEndpointId(DIRECT) ?? ""
    expect(id).not.toContain("senha")
    expect(id).not.toContain("neondb_owner")
    expect(id).not.toContain("@")
  })

  it("devolve null para entradas ausentes ou inválidas", () => {
    expect(databaseEndpointId(undefined)).toBeNull()
    expect(databaseEndpointId("")).toBeNull()
    expect(databaseEndpointId("nao-e-uma-url")).toBeNull()
  })
})
