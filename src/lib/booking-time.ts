import { MAX_BOOKING_HOURS } from "./booking-rules"

/** Hora em que a lavanderia abre — usada como padrão do formulário. */
export const OPENING_HOUR = 8

/** Durações oferecidas no formulário, limitadas por `MAX_BOOKING_HOURS`. */
export const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1h 30m", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "3 horas", value: 180 },
  { label: "4 horas", value: 240 },
  { label: "6 horas", value: 360 },
  { label: "8 horas", value: 480 },
].filter((option) => option.value <= MAX_BOOKING_HOURS * 60)

export const DEFAULT_DURATION_MINUTES = 120

/**
 * Início sugerido: a abertura do dia se ainda não passou; caso contrário,
 * o próximo slot de meia hora a partir de agora.
 */
export function getDefaultStart(now: Date = new Date()): Date {
  const start = new Date(now)
  start.setHours(OPENING_HOUR, 0, 0, 0)
  if (start.getTime() > now.getTime()) return start

  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(next.getMinutes() <= 30 ? 30 : 60)
  return next
}

/** Fim derivado do início mais a duração escolhida. */
export function computeEnd(start: Date, durationMinutes: number): Date {
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + durationMinutes)
  return end
}
