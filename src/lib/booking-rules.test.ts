import { describe, expect, it } from "vitest"
import {
  BookingLimitError,
  BookingNotFoundError,
  BookingValidationError,
  MACHINE_NUMBERS,
  MAX_APARTMENT_BOOKINGS,
  MAX_BOOKING_HOURS,
  isValidMachineNumber,
} from "./booking-rules"

describe("constantes de regra", () => {
  it("mantém os limites acordados com o condomínio", () => {
    expect(MAX_BOOKING_HOURS).toBe(8)
    expect(MAX_APARTMENT_BOOKINGS).toBe(2)
    expect(MACHINE_NUMBERS).toEqual([1, 2, 3])
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
  })

  it("continua sendo instância de Error", () => {
    expect(new BookingLimitError("x")).toBeInstanceOf(Error)
  })

  it("usa uma mensagem padrão em BookingNotFoundError", () => {
    expect(new BookingNotFoundError().message).toBe("Agendamento não encontrado")
  })
})
