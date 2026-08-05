import { beforeEach, describe, expect, it, vi } from "vitest"
import { prismaMock, resetPrismaMock } from "./test-utils/prisma-mock"

vi.mock("./prisma", () => ({ prisma: prismaMock }))

const {
  BookingLimitError,
  BookingLockedError,
  BookingNotFoundError,
  BookingValidationError,
  BookingWeeklyLimitError,
  MachineInMaintenanceError,
  createBooking,
  deleteBooking,
  deleteExpiredBookings,
  listBookingsByDate,
  validateBookingInput,
} = await import("./booking-service")

const { BOOKING_RETENTION_DAYS, BOOKING_WINDOW_DAYS, MAX_APARTMENT_BOOKINGS_PER_WINDOW } =
  await import("./booking-rules")

const NOW = new Date(2026, 6, 27, 10, 0)
const DAY_MS = 24 * 60 * 60 * 1000

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

  it("detecta se a máquina está em manutenção", async () => {
    prismaMock.booking.findFirst.mockResolvedValue(null)
    prismaMock.maintenance.findFirst.mockResolvedValue({ id: "maint1" })

    await expect(createBooking(input())).rejects.toBeInstanceOf(MachineInMaintenanceError)
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
      .mockResolvedValueOnce({
        id: "antigo",
        startTime: new Date(NOW.getTime() + 2 * DAY_MS), // ainda longe do início
        endTime: new Date(NOW.getTime() + 2 * DAY_MS + 2 * 60 * 60 * 1000),
      })
    prismaMock.booking.create.mockResolvedValue({ id: "novo" })

    await expect(createBooking(input({ replaceOldest: true }))).resolves.toEqual({ id: "novo" })
    expect(prismaMock.booking.delete).toHaveBeenCalledWith({ where: { id: "antigo" } })
  })

  it("recusa substituir o mais antigo quando ele já foi efetivado", async () => {
    prismaMock.booking.count.mockResolvedValue(2)
    prismaMock.booking.findFirst
      .mockResolvedValueOnce(null) // sem conflito de horário
      .mockResolvedValueOnce({
        id: "antigo",
        startTime: new Date(NOW.getTime() - 90 * 60 * 1000), // começou há 1h30
        endTime: new Date(NOW.getTime() + 60 * 60 * 1000), // e ainda está em curso
      })

    await expect(createBooking(input({ replaceOldest: true }))).rejects.toBeInstanceOf(
      BookingLockedError
    )
    expect(prismaMock.booking.delete).not.toHaveBeenCalled()
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })

  it("lança BookingWeeklyLimitError ao atingir o limite semanal", async () => {
    prismaMock.booking.count.mockResolvedValueOnce(MAX_APARTMENT_BOOKINGS_PER_WINDOW)
    prismaMock.booking.findFirst
      .mockResolvedValueOnce(null) // sem conflito de horário
      .mockResolvedValueOnce({
        id: "mais-antigo-da-semana",
        startTime: new Date(2026, 6, 22, 9, 0),
      }) // mais antigo dentro da janela semanal

    await expect(createBooking(input())).rejects.toBeInstanceOf(BookingWeeklyLimitError)
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })

  it("consulta o limite semanal pela janela de BOOKING_WINDOW_DAYS dias terminando agora", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: "b1" })

    await createBooking(input())

    const where = prismaMock.booking.count.mock.calls[0][0].where
    expect(where.apartmentNumber).toBe("101")
    expect(where.startTime.gte).toEqual(new Date(NOW.getTime() - BOOKING_WINDOW_DAYS * DAY_MS))
  })

  it("não conta agendamentos já encerrados para o limite de simultâneos", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: "b1" })

    await createBooking(input())

    const concurrentWhere = prismaMock.booking.count.mock.calls[1][0].where
    expect(concurrentWhere).toEqual({ apartmentNumber: "101", endTime: { gt: NOW } })
  })

  it("não persiste nada quando a validação falha", async () => {
    await expect(createBooking(input({ machineNumber: 9 }))).rejects.toThrow()
    expect(prismaMock.booking.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.booking.create).not.toHaveBeenCalled()
  })
})

describe("deleteBooking", () => {
  it("remove quando o agendamento existe e ainda não foi efetivado", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "b1",
      startTime: new Date(NOW.getTime() + 2 * DAY_MS),
      endTime: new Date(NOW.getTime() + 2 * DAY_MS + 2 * 60 * 60 * 1000),
    })
    prismaMock.booking.delete.mockResolvedValue({ id: "b1" })

    await expect(deleteBooking("b1")).resolves.toEqual({ id: "b1" })
  })

  // Regra nova: a consolidação passou a contar 1h DEPOIS do início, então
  // desistir de um horário que está prestes a começar voltou a ser permitido.
  it("remove um agendamento prestes a começar", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "b1",
      startTime: new Date(NOW.getTime() + 30 * 60 * 1000), // começa em 30min
      endTime: new Date(NOW.getTime() + 3 * 60 * 60 * 1000),
    })
    prismaMock.booking.delete.mockResolvedValue({ id: "b1" })

    await expect(deleteBooking("b1")).resolves.toEqual({ id: "b1" })
  })

  it("remove um agendamento recém-iniciado, dentro da folga", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "b1",
      startTime: new Date(NOW.getTime() - 30 * 60 * 1000), // começou há 30min
      endTime: new Date(NOW.getTime() + 90 * 60 * 1000),
    })
    prismaMock.booking.delete.mockResolvedValue({ id: "b1" })

    await expect(deleteBooking("b1")).resolves.toEqual({ id: "b1" })
  })

  it("lança BookingNotFoundError quando não existe", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null)

    await expect(deleteBooking("nope")).rejects.toBeInstanceOf(BookingNotFoundError)
    expect(prismaMock.booking.delete).not.toHaveBeenCalled()
  })

  it("lança BookingLockedError passada a folga desde o início", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "b1",
      startTime: new Date(NOW.getTime() - 90 * 60 * 1000), // começou há 1h30
      endTime: new Date(NOW.getTime() + 60 * 60 * 1000),
    })

    await expect(deleteBooking("b1")).rejects.toBeInstanceOf(BookingLockedError)
    expect(prismaMock.booking.delete).not.toHaveBeenCalled()
  })

  // Fecha a brecha de lavar e apagar o registro para não gastar a cota semanal.
  it("lança BookingLockedError para agendamento curto que já terminou", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "b1",
      startTime: new Date(NOW.getTime() - 45 * 60 * 1000), // começou há 45min
      endTime: new Date(NOW.getTime() - 15 * 60 * 1000), // e terminou há 15min
    })

    await expect(deleteBooking("b1")).rejects.toBeInstanceOf(BookingLockedError)
    expect(prismaMock.booking.delete).not.toHaveBeenCalled()
  })
})

describe("deleteExpiredBookings", () => {
  it("remove apenas o que terminou há mais que a janela de retenção", async () => {
    prismaMock.booking.deleteMany.mockResolvedValue({ count: 3 })

    await expect(deleteExpiredBookings()).resolves.toBe(3)

    const where = prismaMock.booking.deleteMany.mock.calls[0][0].where
    expect(where.endTime.lt).toEqual(new Date(NOW.getTime() - BOOKING_RETENTION_DAYS * DAY_MS))
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
