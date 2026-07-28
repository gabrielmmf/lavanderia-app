import { prisma } from "./prisma"
import {
  BookingLimitError,
  BookingNotFoundError,
  BookingValidationError,
  MAX_APARTMENT_BOOKINGS,
  MAX_BOOKING_HOURS,
  isValidMachineNumber,
} from "./booking-rules"

export {
  BookingLimitError,
  BookingNotFoundError,
  BookingValidationError,
  MACHINE_NUMBERS,
  MAX_APARTMENT_BOOKINGS,
  MAX_BOOKING_HOURS,
} from "./booking-rules"

/** Janela de retenção de agendamentos já encerrados, em milissegundos. */
const RETENTION_MS = 24 * 60 * 60 * 1000

/** Remove agendamentos encerrados há mais de 24 horas. */
export async function deleteExpiredBookings() {
  const threshold = new Date(Date.now() - RETENTION_MS)
  const result = await prisma.booking.deleteMany({
    where: {
      endTime: { lt: threshold },
    },
  })
  return result.count
}

export type CreateBookingInput = {
  apartmentNumber: string
  machineNumber: number
  startTime: Date
  endTime: Date
  replaceOldest?: boolean
}

/**
 * Valida as regras puras de um agendamento (sem tocar no banco).
 * Exportado separadamente para permitir testes sem infraestrutura.
 */
export function validateBookingInput(
  data: CreateBookingInput,
  now: Date = new Date()
): void {
  if (!data.apartmentNumber?.trim()) {
    throw new BookingValidationError("Informe o número do apartamento")
  }
  if (data.startTime < now) {
    throw new BookingValidationError("Não é possível agendar no passado")
  }
  if (data.startTime >= data.endTime) {
    throw new BookingValidationError("Horário inválido")
  }

  const durationHours =
    (data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60 * 60)
  if (durationHours > MAX_BOOKING_HOURS) {
    throw new BookingValidationError(
      `O agendamento não pode exceder ${MAX_BOOKING_HOURS} horas`
    )
  }

  if (!isValidMachineNumber(data.machineNumber)) {
    throw new BookingValidationError("Máquina inválida")
  }
}

export async function createBooking(data: CreateBookingInput) {
  validateBookingInput(data)

  const conflict = await prisma.booking.findFirst({
    where: {
      machineNumber: data.machineNumber,
      startTime: { lt: data.endTime },
      endTime: { gt: data.startTime },
    },
  })

  if (conflict) {
    throw new BookingValidationError(
      `Máquina ${data.machineNumber} já está agendada nesse horário`
    )
  }

  const count = await prisma.booking.count({
    where: { apartmentNumber: data.apartmentNumber },
  })

  if (count >= MAX_APARTMENT_BOOKINGS) {
    if (data.replaceOldest) {
      const oldest = await prisma.booking.findFirst({
        where: { apartmentNumber: data.apartmentNumber },
        orderBy: { startTime: "asc" },
      })
      if (oldest) {
        await prisma.booking.delete({ where: { id: oldest.id } })
      }
    } else {
      throw new BookingLimitError(
        `O apartamento ${data.apartmentNumber} já possui ${MAX_APARTMENT_BOOKINGS} agendamentos. O agendamento mais antigo será removido para permitir este novo.`
      )
    }
  }

  return prisma.booking.create({
    data: {
      apartmentNumber: data.apartmentNumber,
      machineNumber: data.machineNumber,
      startTime: data.startTime,
      endTime: data.endTime,
    },
  })
}

export async function listBookingsByDate(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  return prisma.booking.findMany({
    where: {
      startTime: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      startTime: "asc",
    },
  })
}

export async function listAllBookings() {
  return prisma.booking.findMany({
    orderBy: {
      startTime: "asc",
    },
  })
}

export async function deleteBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    throw new BookingNotFoundError()
  }
  return prisma.booking.delete({ where: { id } })
}
