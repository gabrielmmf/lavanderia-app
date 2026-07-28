/**
 * Regras de negócio dos agendamentos.
 *
 * Este módulo é intencionalmente livre de dependências (sem Prisma, sem React)
 * para poder ser importado tanto pelo servidor quanto por componentes client
 * sem arrastar o Prisma Client para o bundle do navegador.
 */

/** Duração máxima de um único agendamento, em horas. */
export const MAX_BOOKING_HOURS = 8

/** Quantidade máxima de agendamentos simultâneos por apartamento. */
export const MAX_APARTMENT_BOOKINGS = 2

/** Máquinas disponíveis na lavanderia. */
export const MACHINE_NUMBERS = [1, 2, 3] as const

export type MachineNumber = (typeof MACHINE_NUMBERS)[number]

export function isValidMachineNumber(value: number): value is MachineNumber {
  return (MACHINE_NUMBERS as readonly number[]).includes(value)
}

/** Lançado quando o apartamento já atingiu o limite de agendamentos simultâneos. */
export class BookingLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingLimitError"
  }
}

/** Lançado quando o agendamento referenciado não existe. */
export class BookingNotFoundError extends Error {
  constructor(message = "Agendamento não encontrado") {
    super(message)
    this.name = "BookingNotFoundError"
  }
}

/** Lançado quando os dados enviados violam uma regra de agendamento. */
export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingValidationError"
  }
}
