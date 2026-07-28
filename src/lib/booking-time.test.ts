import { afterEach, describe, expect, it, vi } from "vitest"
import { MAX_BOOKING_HOURS } from "./booking-rules"
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  OPENING_HOUR,
  computeEnd,
  getDefaultStart,
} from "./booking-time"

afterEach(() => {
  vi.useRealTimers()
})

describe("DURATION_OPTIONS", () => {
  it("nunca oferece uma duração acima do limite de negócio", () => {
    for (const option of DURATION_OPTIONS) {
      expect(option.value).toBeLessThanOrEqual(MAX_BOOKING_HOURS * 60)
    }
  })

  it("contém a duração padrão", () => {
    expect(DURATION_OPTIONS.map((o) => o.value)).toContain(DEFAULT_DURATION_MINUTES)
  })

  it("está em ordem crescente", () => {
    const values = DURATION_OPTIONS.map((o) => o.value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })
})

describe("getDefaultStart", () => {
  it("sugere a abertura quando o dia ainda não começou", () => {
    const now = new Date(2026, 6, 27, 6, 12)
    const start = getDefaultStart(now)
    expect(start.getHours()).toBe(OPENING_HOUR)
    expect(start.getMinutes()).toBe(0)
    expect(start.getDate()).toBe(27)
  })

  it("arredonda para :30 quando já passou da abertura e estamos na 1ª metade da hora", () => {
    const now = new Date(2026, 6, 27, 10, 12)
    const start = getDefaultStart(now)
    expect(start.getHours()).toBe(10)
    expect(start.getMinutes()).toBe(30)
  })

  it("avança para a hora cheia seguinte na 2ª metade da hora", () => {
    const now = new Date(2026, 6, 27, 10, 47)
    const start = getDefaultStart(now)
    expect(start.getHours()).toBe(11)
    expect(start.getMinutes()).toBe(0)
  })

  it("nunca sugere um horário no passado", () => {
    const now = new Date(2026, 6, 27, 23, 50)
    expect(getDefaultStart(now).getTime()).toBeGreaterThanOrEqual(now.getTime())
  })

  it("zera segundos e milissegundos", () => {
    const now = new Date(2026, 6, 27, 10, 12, 45, 678)
    const start = getDefaultStart(now)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it("usa a hora atual quando nenhum `now` é passado", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 5, 0))
    expect(getDefaultStart().getHours()).toBe(OPENING_HOUR)
  })
})

describe("computeEnd", () => {
  it("soma a duração ao início", () => {
    const start = new Date(2026, 6, 27, 8, 0)
    expect(computeEnd(start, 120)).toEqual(new Date(2026, 6, 27, 10, 0))
  })

  it("atravessa a virada do dia corretamente", () => {
    const start = new Date(2026, 6, 27, 23, 30)
    expect(computeEnd(start, 60)).toEqual(new Date(2026, 6, 28, 0, 30))
  })

  it("não muta a data de início", () => {
    const start = new Date(2026, 6, 27, 8, 0)
    const snapshot = start.getTime()
    computeEnd(start, 480)
    expect(start.getTime()).toBe(snapshot)
  })
})
