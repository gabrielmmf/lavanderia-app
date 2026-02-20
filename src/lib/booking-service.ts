import { prisma } from "./prisma"

/** Remove agendamentos cujo horário de fim já passou */
export async function deleteExpiredBookings() {
  const now = new Date()
  const result = await prisma.booking.deleteMany({
    where: {
      endTime: { lt: now }
    }
  })
  return result.count
}

const MAX_BOOKING_HOURS = 8
const MAX_APARTMENT_BOOKINGS = 2

export class BookingLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingLimitError"
  }
}

export async function createBooking(data: {
  apartmentNumber: string
  machineNumber: number
  startTime: Date
  endTime: Date
  replaceOldest?: boolean
}) {
  const now = new Date()
  if (data.startTime < now) {
    throw new Error("Não é possível agendar no passado")
  }
  if (data.startTime >= data.endTime) {
    throw new Error("Horário inválido")
  }

  const durationMs = data.endTime.getTime() - data.startTime.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)
  if (durationHours > MAX_BOOKING_HOURS) {
    throw new Error(`O agendamento não pode exceder ${MAX_BOOKING_HOURS} horas`)
  }

  if (data.machineNumber < 1 || data.machineNumber > 3) {
    throw new Error("Máquina inválida")
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      machineNumber: data.machineNumber,
      startTime: { lt: data.endTime },
      endTime: { gt: data.startTime }
    }
  })

  if (conflict) {
    throw new Error(`Máquina ${data.machineNumber} já está agendada nesse horário`)
  }

  const count = await prisma.booking.count({
    where: { apartmentNumber: data.apartmentNumber }
  })

  if (count >= MAX_APARTMENT_BOOKINGS) {
    if (data.replaceOldest) {
      const oldest = await prisma.booking.findFirst({
        where: { apartmentNumber: data.apartmentNumber },
        orderBy: { startTime: "asc" }
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
      endTime: data.endTime
    }
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
        lte: end
      }
    },
    orderBy: {
      startTime: "asc"
    }
  })
}

export async function listAllBookings() {
  return prisma.booking.findMany({
    orderBy: {
      startTime: "asc"
    }
  })
}

export async function deleteBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    throw new Error("Agendamento não encontrado")
  }
  return prisma.booking.delete({ where: { id } })
}