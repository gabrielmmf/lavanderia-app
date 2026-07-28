import { describe, expect, it } from "vitest"
import {
  BookingLimitError,
  BookingLockedError,
  BookingNotFoundError,
  BookingValidationError,
  BookingWeeklyLimitError,
  BOOKING_WINDOW_DAYS,
  EFFECTUATION_LEAD_MINUTES,
  MACHINE_NUMBERS,
  MAX_APARTMENT_BOOKINGS,
  MAX_APARTMENT_BOOKINGS_PER_WINDOW,
  MAX_BOOKING_HOURS,
  formatLeadMinutes,
  isBookingEffectuated,
  isValidMachineNumber,
} from "./booking-rules"

describe("constantes de regra", () => {
  it("mantém os limites acordados com o condomínio", () => {
    expect(MAX_BOOKING_HOURS).toBe(8)
    expect(MAX_APARTMENT_BOOKINGS).toBe(2)
    expect(MACHINE_NUMBERS).toEqual([1, 2, 3])
    expect(EFFECTUATION_LEAD_MINUTES).toBe(60)
    expect(BOOKING_WINDOW_DAYS).toBe(7)
    expect(MAX_APARTMENT_BOOKINGS_PER_WINDOW).toBe(4)
  })
})

describe("isBookingEffectuated", () => {
  const now = new Date(2026, 6, 27, 10, 0)

  it("não considera efetivado quando falta mais que o prazo de antecedência", () => {
    const startTime = new Date(2026, 6, 27, 12, 0) // 2h depois
    expect(isBookingEffectuated(startTime, now)).toBe(false)
  })

  it("considera efetivado quando falta menos que o prazo de antecedência", () => {
    const startTime = new Date(2026, 6, 27, 10, 30) // 30min depois
    expect(isBookingEffectuated(startTime, now)).toBe(true)
  })

  it("considera efetivado um agendamento já em andamento ou concluído", () => {
    const startTime = new Date(2026, 6, 27, 9, 0) // 1h antes
    expect(isBookingEffectuated(startTime, now)).toBe(true)
  })

  it("é o limite exato: falta exatamente o prazo de antecedência ainda não é efetivado", () => {
    const startTime = new Date(now.getTime() + EFFECTUATION_LEAD_MINUTES * 60 * 1000)
    expect(isBookingEffectuated(startTime, now)).toBe(false)
  })
})

describe("formatLeadMinutes", () => {
  it("formata múltiplos de 60 minutos como horas", () => {
    expect(formatLeadMinutes(60)).toBe("1 hora")
    expect(formatLeadMinutes(120)).toBe("2 horas")
  })

  it("formata o restante como minutos", () => {
    expect(formatLeadMinutes(30)).toBe("30 minutos")
    expect(formatLeadMinutes(90)).toBe("90 minutos")
  })
})

describe("isValidMachineNumber", () => {
  it.each(MACHINE_NUMBERS)("aceita a máquina %i", (machine) => {
    expect(isValidMachineNumber(machine)).toBe(true)
  })

  it.each([0, 4, -1, 1.5, Number.NaN])("rejeita %p", (machine) => {
    expect(isValidMachineNumber(machine)).toBe(false)
  })
})

describe("erros de domínio", () => {
  it("expõe `name` estável, usado como código na API", () => {
    expect(new BookingLimitError("x").name).toBe("BookingLimitError")
    expect(new BookingNotFoundError().name).toBe("BookingNotFoundError")
    expect(new BookingValidationError("x").name).toBe("BookingValidationError")
    expect(new BookingWeeklyLimitError("x").name).toBe("BookingWeeklyLimitError")
    expect(new BookingLockedError("x").name).toBe("BookingLockedError")
  })

  it("continua sendo instância de Error", () => {
    expect(new BookingLimitError("x")).toBeInstanceOf(Error)
  })

  it("usa uma mensagem padrão em BookingNotFoundError", () => {
    expect(new BookingNotFoundError().message).toBe("Agendamento não encontrado")
  })
})
