import { describe, expect, it } from "vitest"
import {
  BookingLimitError,
  BookingLockedError,
  BookingNotFoundError,
  BookingValidationError,
  BookingWeeklyLimitError,
  BOOKING_WINDOW_DAYS,
  EFFECTUATION_DELAY_MINUTES,
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
    expect(EFFECTUATION_DELAY_MINUTES).toBe(60)
    expect(BOOKING_WINDOW_DAYS).toBe(7)
    expect(MAX_APARTMENT_BOOKINGS_PER_WINDOW).toBe(4)
  })
})

describe("isBookingEffectuated", () => {
  const now = new Date(2026, 6, 27, 10, 0)

  /** Agendamento longo o bastante para não terminar antes do prazo de folga. */
  function longo(startTime: Date) {
    return new Date(startTime.getTime() + 4 * 60 * 60 * 1000)
  }

  it("não considera efetivado um agendamento ainda no futuro", () => {
    const startTime = new Date(2026, 6, 27, 12, 0) // 2h depois
    expect(isBookingEffectuated(startTime, longo(startTime), now)).toBe(false)
  })

  // A regra mudou: antes um agendamento prestes a começar já era efetivado.
  // Agora o morador ainda pode desistir até depois de a hora chegar.
  it("não considera efetivado um agendamento prestes a começar", () => {
    const startTime = new Date(2026, 6, 27, 10, 30) // 30min depois
    expect(isBookingEffectuated(startTime, longo(startTime), now)).toBe(false)
  })

  it("não considera efetivado um agendamento recém-iniciado", () => {
    const startTime = new Date(2026, 6, 27, 9, 30) // começou há 30min
    expect(isBookingEffectuated(startTime, longo(startTime), now)).toBe(false)
  })

  it("considera efetivado depois do prazo de folga a partir do início", () => {
    const startTime = new Date(2026, 6, 27, 8, 30) // começou há 1h30
    expect(isBookingEffectuated(startTime, longo(startTime), now)).toBe(true)
  })

  it("é o limite exato: exatamente o prazo de folga já é efetivado", () => {
    const startTime = new Date(now.getTime() - EFFECTUATION_DELAY_MINUTES * 60 * 1000)
    expect(isBookingEffectuated(startTime, longo(startTime), now)).toBe(true)
  })

  // Sem esta regra, uma reserva curta poderia ser usada e apagada em seguida,
  // devolvendo a vaga no limite semanal de graça.
  it("considera efetivado um agendamento curto que já terminou", () => {
    const startTime = new Date(2026, 6, 27, 9, 15) // começou há 45min
    const endTime = new Date(2026, 6, 27, 9, 45) // e já terminou
    expect(isBookingEffectuated(startTime, endTime, now)).toBe(true)
  })

  it("considera efetivado no instante exato do término", () => {
    const startTime = new Date(2026, 6, 27, 9, 30)
    expect(isBookingEffectuated(startTime, now, now)).toBe(true)
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
