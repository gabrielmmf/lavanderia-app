import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "./test-utils/prisma-mock"

vi.mock("./prisma", () => ({ prisma: prismaMock }))

const {
  BookingLimitError,
  BookingNotFoundError,
  BookingValidationError,
  createBooking,
  deleteBooking,
  deleteExpiredBookings,
  listBookingsByDate,
  validateBookingInput,
} = await import("./booking-service")

const NOW = new Date(2026, 6, 27, 10, 0)

function input(overrides: Partial<Parameters<typeof createBooking>[0]> = {}) {
  return {
    apartmentNumber: "101",
    machineNumber: 1,
    startTime: new Date(2026, 6, 27, 12, 0),
    endTime: new Date(2026, 6, 27, 14, 0),
    ...overrides,
  }
}

beforeEach(() => {
  resetPrismaMock()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe("validateBookingInput", () => {
  it("aceita um agendamento válido", () => {
    expect(() => validateBookingInput(input(), NOW)).not.toThrow()
  })

  it("exige o número do apartamento", () => {
    expect(() => validateBookingInput(input({ apartmentNumber: "   " }), NOW)).toThrow(
      BookingValidationError
    )
  })

  it("recusa agendamento no passado", () => {
    expect(() =>
      validateBookingInput(input({ startTime: new Date(2026, 6, 27, 9, 0) }), NOW)
    ).toThrow(/passado/)
  })

  it("recusa fim anterior ou igual ao início", () => {
    const startTime = new Date(2026, 6, 27, 12, 0)
    expect(() => validateBookingInput(input({ startTime, endTime: startTime }), NOW)).toThrow(
      /inválido/
    )
  })

  it("recusa duração acima de 8 horas", () => {
    expect(() =>
      validateBookingInput(
        input({
          startTime: new Date(2026, 6, 27, 12, 0),
          endTime: new Date(2026, 6, 27, 20, 1),
        }),
        NOW
      )
    ).toThrow(/8 horas/)
  })

  it("aceita exatamente 8 horas", () => {
    expect(() =>
      validateBookingInput(
        input({
          startTime: new Date(2026, 6, 27, 12, 0),
          endTime: new Date(2026, 6, 27, 20, 0),
        }),
        NOW
      )
    ).not.toThrow()
  })

  it("recusa máquina inexistente", () => {
    expect(() => validateBookingInput(input({ machineNumber: 4 }), NOW)).toThrow(/Máquina/)
  })
})

describe("createBooking", () => {
  it("cria quando não há conflito nem limite atingido", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: "b1" })

    await expect(createBooking(input())).resolves.toEqual({ id: "b1" })
    expect(prismaMock.booking.create).toHaveBeenCalledOnce()
  })

  it("detecta sobreposição na mesma máquina", async () => {
    prismaMock.booking.findFirst.mockResolvedValue({ id: "existente" })

    await expect(createBooking(input())).rejects.toThrow(/já está agendada/)
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })

  it("consulta conflito com intervalos semiabertos (start < end && end > start)", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: "b1" })
    const data = input()

    await createBooking(data)

    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith({
      where: {
        machineNumber: data.machineNumber,
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime },
      },
    })
  })

  it("lança BookingLimitError ao atingir o limite do apartamento", async () => {
    prismaMock.booking.count.mockResolvedValue(2)

    await expect(createBooking(input())).rejects.toBeInstanceOf(BookingLimitError)
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })

  it("substitui o agendamento mais antigo quando replaceOldest é true", async () => {
    prismaMock.booking.count.mockResolvedValue(2)
    prismaMock.booking.findFirst
      .mockResolvedValueOnce(null) // sem conflito de horário
      .mockResolvedValueOnce({ id: "antigo" }) // o mais antigo do apartamento
    prismaMock.booking.create.mockResolvedValue({ id: "novo" })

    await expect(createBooking(input({ replaceOldest: true }))).resolves.toEqual({ id: "novo" })
    expect(prismaMock.booking.delete).toHaveBeenCalledWith({ where: { id: "antigo" } })
  })

  it("não persiste nada quando a validação falha", async () => {
    await expect(createBooking(input({ machineNumber: 9 }))).rejects.toThrow()
    expect(prismaMock.booking.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })
})

describe("deleteBooking", () => {
  it("remove quando o agendamento existe", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({ id: "b1" })
    prismaMock.booking.delete.mockResolvedValue({ id: "b1" })

    await expect(deleteBooking("b1")).resolves.toEqual({ id: "b1" })
  })

  it("lança BookingNotFoundError quando não existe", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null)

    await expect(deleteBooking("nope")).rejects.toBeInstanceOf(BookingNotFoundError)
    expect(prismaMock.booking.delete).not.toHaveBeenCalled()
  })
})

describe("deleteExpiredBookings", () => {
  it("remove apenas o que terminou há mais de 24h", async () => {
    prismaMock.booking.deleteMany.mockResolvedValue({ count: 3 })

    await expect(deleteExpiredBookings()).resolves.toBe(3)

    const where = prismaMock.booking.deleteMany.mock.calls[0][0].where
    expect(where.endTime.lt).toEqual(new Date(NOW.getTime() - 24 * 60 * 60 * 1000))
  })
})

describe("listBookingsByDate", () => {
  it("filtra pelo dia inteiro no fuso local", async () => {
    await listBookingsByDate(new Date(2026, 6, 27, 15, 30))

    const where = prismaMock.booking.findMany.mock.calls[0][0].where
    expect(where.startTime.gte).toEqual(new Date(2026, 6, 27, 0, 0, 0, 0))
    expect(where.startTime.lte).toEqual(new Date(2026, 6, 27, 23, 59, 59, 999))
  })
})
