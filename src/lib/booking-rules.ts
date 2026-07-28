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

/**
 * Minutos de antecedência a partir dos quais um agendamento é considerado
 * "efetivado": passa a contar como uso e o morador não pode mais apagá-lo.
 * Isso fecha a brecha de apagar um agendamento em andamento (ou prestes a
 * começar) só para conseguir marcar outro em seguida.
 */
export const EFFECTUATION_LEAD_MINUTES = 60

/**
 * Descrição legível de `EFFECTUATION_LEAD_MINUTES`, para textos de UI e
 * mensagens de erro (ex.: "1 hora" em vez de "60 minutos").
 */
export function formatLeadMinutes(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} ${hours > 1 ? "horas" : "hora"}`
  }
  return `${minutes} minutos`
}

export const EFFECTUATION_LEAD_LABEL = formatLeadMinutes(EFFECTUATION_LEAD_MINUTES)

/**
 * Tamanho da janela, em dias, usada para o limite semanal de agendamentos
 * por apartamento.
 */
export const BOOKING_WINDOW_DAYS = 7

/**
 * Quantidade máxima de agendamentos que um apartamento pode iniciar dentro
 * de uma janela de `BOOKING_WINDOW_DAYS` dias.
 */
export const MAX_APARTMENT_BOOKINGS_PER_WINDOW = 4

/**
 * Agendamentos encerrados há mais desse número de dias são removidos
 * automaticamente. Igual a `BOOKING_WINDOW_DAYS` de propósito: o limite
 * semanal só barra uso repetido de verdade se o histórico da janela inteira
 * ainda existir no banco na hora de contar.
 */
export const BOOKING_RETENTION_DAYS = BOOKING_WINDOW_DAYS

/**
 * Um agendamento é "efetivado" quando falta menos de
 * `EFFECTUATION_LEAD_MINUTES` para o início — o que também cobre um
 * agendamento em andamento ou já concluído, já que a diferença fica negativa.
 */
export function isBookingEffectuated(startTime: Date, now: Date = new Date()): boolean {
  const msUntilStart = startTime.getTime() - now.getTime()
  return msUntilStart < EFFECTUATION_LEAD_MINUTES * 60 * 1000
}

/** Lançado quando o apartamento já atingiu o limite de agendamentos simultâneos. */
export class BookingLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingLimitError"
  }
}

/** Lançado quando o apartamento já atingiu o limite semanal de agendamentos. */
export class BookingWeeklyLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingWeeklyLimitError"
  }
}

/** Lançado ao tentar apagar (ou substituir) um agendamento já efetivado. */
export class BookingLockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BookingLockedError"
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
