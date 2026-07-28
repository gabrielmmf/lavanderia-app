/**
 * Antecedência (em minutos) com que avisamos o usuário antes do início e do
 * término da reserva. Compartilhado entre o job de cron e a UI para que a
 * mensagem exibida e o comportamento real nunca divirjam.
 */
export const NOTIFICATION_LEAD_MINUTES = 15

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
