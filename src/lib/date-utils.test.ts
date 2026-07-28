import { describe, expect, it } from "vitest"
import { formatDateBR, formatDateTimeBR, formatTimeBR } from "./date-utils"

const DATE = new Date(2026, 6, 5, 9, 7)

describe("formatDateBR", () => {
  it("usa dd/mm/aaaa com zero à esquerda", () => {
    expect(formatDateBR(DATE)).toBe("05/07/2026")
  })

  it("aceita string ISO", () => {
    expect(formatDateBR(DATE.toISOString())).toBe("05/07/2026")
  })
})

describe("formatTimeBR", () => {
  it("usa 24h com zero à esquerda", () => {
    expect(formatTimeBR(DATE)).toBe("09:07")
  })

  it("não usa 12h para horários da tarde", () => {
    expect(formatTimeBR(new Date(2026, 6, 5, 22, 30))).toBe("22:30")
  })

  it("formata a meia-noite como 00:00", () => {
    expect(formatTimeBR(new Date(2026, 6, 5, 0, 0))).toBe("00:00")
  })
})

describe("formatDateTimeBR", () => {
  it("combina data e hora", () => {
    expect(formatDateTimeBR(DATE)).toBe("05/07/2026 09:07")
  })
})
