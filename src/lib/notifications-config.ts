/**
 * Antecedência (em minutos) com que avisamos o usuário antes do início e do
 * término da reserva. Compartilhado entre o job de cron e a UI para que a
 * mensagem exibida e o comportamento real nunca divirjam.
 */
export const NOTIFICATION_LEAD_MINUTES = 15

/**
 * Por quantos minutos além do momento previsto ainda vale a pena enviar o
 * aviso atrasado.
 *
 * Existe porque o agendador não é pontual: o `schedule` do GitHub Actions
 * chega a espaçar as execuções em horas, e o ciclo precisa continuar
 * entregando o que ficou para trás em vez de deixar o agendamento vazar da
 * janela sem nunca ter sido notificado. Passado esse prazo o aviso vira ruído
 * — o agendamento é marcado como tratado sem envio.
 */
export const NOTIFICATION_GRACE_MINUTES = 60

/**
 * Texto do corpo da notificação de início, conforme os minutos que realmente
 * faltam no momento do envio.
 *
 * A mensagem é calculada, e não fixa em `NOTIFICATION_LEAD_MINUTES`, porque um
 * aviso atrasado dizendo "começa em 15 minutos" quando o horário já começou
 * seria pior que não avisar.
 */
export function startNotificationBody(machineNumber: number, minutesUntil: number): string {
  const quando =
    minutesUntil <= 0
      ? "já começou"
      : `começa em ${minutesUntil} ${minutesUntil === 1 ? "minuto" : "minutos"}`
  return `Sua reserva na máquina ${machineNumber} ${quando}.`
}

/** Equivalente de `startNotificationBody` para o aviso de término. */
export function endNotificationBody(machineNumber: number, minutesUntil: number): string {
  if (minutesUntil <= 0) {
    return `Sua reserva na máquina ${machineNumber} terminou. Retire as roupas para liberar a máquina.`
  }
  const plural = minutesUntil === 1 ? "minuto" : "minutos"
  return `Sua reserva na máquina ${machineNumber} termina em ${minutesUntil} ${plural}. Prepare-se para retirar as roupas.`
}

/**
 * Comprimento de uma chave VAPID pública em base64url.
 *
 * A chave é um ponto da curva P-256 sem compressão: 65 bytes, que em base64url
 * sem padding dão exatamente 87 caracteres.
 */
export const VAPID_PUBLIC_KEY_LENGTH = 87

/**
 * Normaliza a chave VAPID pública vinda do ambiente, devolvendo `null` quando o
 * valor não serve como chave.
 *
 * Existe porque "a variável está preenchida" não é o mesmo que "a chave é
 * válida": um placeholder qualquer passa por um simples teste de string vazia,
 * chega intacto até `pushManager.subscribe` e só então estoura dentro do
 * `atob` — o que a UI não tem como distinguir de uma falha de rede, e vira um
 * "tente novamente" que nunca vai funcionar. Melhor reprovar aqui, cedo e com
 * uma mensagem que aponta para a configuração.
 *
 * Sem dependências de propósito: é usada tanto pelo client quanto pelo servidor.
 */
export function normalizeVapidPublicKey(raw: string | null | undefined): string | null {
  // O padding é removido porque `urlBase64ToUint8Array` recalcula o dele.
  const key = (raw ?? "").trim().replace(/=+$/, "")

  if (key.length !== VAPID_PUBLIC_KEY_LENGTH) return null
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null

  return key
}
