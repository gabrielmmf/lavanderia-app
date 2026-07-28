import { timingSafeEqual } from "node:crypto"

/**
 * Valida o header `Authorization: Bearer <CRON_SECRET>`.
 *
 * O endpoint de cron dispara envio de push e escreve no banco; sem essa
 * verificação qualquer pessoa poderia consumir as notificações pendentes.
 * Se `CRON_SECRET` não estiver definido, a requisição é recusada — falhar
 * fechado é preferível a expor o endpoint por descuido de configuração.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization") ?? ""
  const prefix = "Bearer "
  if (!header.startsWith(prefix)) return false

  const provided = Buffer.from(header.slice(prefix.length))
  const expected = Buffer.from(secret)
  if (provided.length !== expected.length) return false

  return timingSafeEqual(provided, expected)
}
