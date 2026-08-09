import { prisma } from "./prisma"
import { formatDateTimeBR } from "./date-utils"
import {
  BookingLimitError,
  BookingLockedError,
  BookingNotFoundError,
  BookingValidationError,
  BookingWeeklyLimitError,
  BOOKING_RETENTION_DAYS,
  BOOKING_WINDOW_DAYS,
  EFFECTUATION_DELAY_LABEL,
  MAX_APARTMENT_BOOKINGS,
  MAX_APARTMENT_BOOKINGS_PER_WINDOW,
  MAX_BOOKING_HOURS,
  isBookingEffectuated,
  isValidMachineNumber,
  MachineInMaintenanceError,
} from "./booking-rules"

export {
  BookingLimitError,
  BookingLockedError,
  BookingNotFoundError,
  BookingValidationError,
  BookingWeeklyLimitError,
  MACHINE_NUMBERS,
  MAX_APARTMENT_BOOKINGS,
  MAX_APARTMENT_BOOKINGS_PER_WINDOW,
  MAX_BOOKING_HOURS,
  MachineInMaintenanceError,
} from "./booking-rules"

/** Janela de retenção de agendamentos já encerrados, em milissegundos. */
const RETENTION_MS = BOOKING_RETENTION_DAYS * 24 * 60 * 60 * 1000

/** Janela do limite semanal, em milissegundos. */
const WINDOW_MS = BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000

/** Remove agendamentos encerrados há mais de `BOOKING_RETENTION_DAYS` dias. */
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

  const now = new Date()

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

  const maintenance = await prisma.maintenance.findFirst({
    where: {
      machineNumber: data.machineNumber,
      startTime: { lt: data.endTime },
      endTime: { gt: data.startTime },
    },
  })

  if (maintenance) {
    throw new MachineInMaintenanceError(
      `A máquina ${data.machineNumber} estará em manutenção neste horário`
    )
  }

  const windowStart = new Date(now.getTime() - WINDOW_MS)
  const weeklyCount = await prisma.booking.count({
    where: {
      apartmentNumber: data.apartmentNumber,
      startTime: { gte: windowStart },
    },
  })

  if (weeklyCount >= MAX_APARTMENT_BOOKINGS_PER_WINDOW) {
    const oldestInWindow = await prisma.booking.findFirst({
      where: {
        apartmentNumber: data.apartmentNumber,
        startTime: { gte: windowStart },
      },
      orderBy: { startTime: "asc" },
    })
    const availableAgainAt = oldestInWindow
      ? new Date(oldestInWindow.startTime.getTime() + WINDOW_MS)
      : undefined

    throw new BookingWeeklyLimitError(
      `O apartamento ${data.apartmentNumber} já tem ${weeklyCount} agendamentos nos últimos ${BOOKING_WINDOW_DAYS} dias — o limite é ${MAX_APARTMENT_BOOKINGS_PER_WINDOW}.` +
        (availableAgainAt
          ? ` Você poderá agendar novamente a partir de ${formatDateTimeBR(availableAgainAt)}.`
          : "")
    )
  }

  const count = await prisma.booking.count({
    where: { apartmentNumber: data.apartmentNumber, endTime: { gt: now } },
  })

  if (count >= MAX_APARTMENT_BOOKINGS) {
    if (data.replaceOldest) {
      const oldest = await prisma.booking.findFirst({
        where: { apartmentNumber: data.apartmentNumber, endTime: { gt: now } },
        orderBy: { startTime: "asc" },
      })
      if (oldest) {
        if (isBookingEffectuated(oldest.startTime, oldest.endTime, now)) {
          throw new BookingLockedError(
            `O agendamento mais antigo do apartamento ${data.apartmentNumber} já foi efetivado e não pode ser substituído automaticamente. Aguarde ele terminar ou escolha apagar outro agendamento antes de tentar de novo.`
          )
        }
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
  if (isBookingEffectuated(booking.startTime, booking.endTime)) {
    throw new BookingLockedError(
      `Este agendamento já foi efetivado — começou há mais de ${EFFECTUATION_DELAY_LABEL} (ou já terminou) — e não pode mais ser apagado.`
    )
  }
  return prisma.booking.delete({ where: { id } })
}
