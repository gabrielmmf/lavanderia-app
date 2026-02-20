const ptBR = "pt-BR"

/** Formato brasileiro: dd/mm/aaaa */
export function formatDateBR(date: Date | string): string {
  return new Date(date).toLocaleDateString(ptBR, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Formato 24h: HH:mm */
export function formatTimeBR(date: Date | string): string {
  return new Date(date).toLocaleTimeString(ptBR, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Formato brasileiro: dd/mm/aaaa HH:mm */
export function formatDateTimeBR(date: Date | string): string {
  return `${formatDateBR(date)} ${formatTimeBR(date)}`
}
