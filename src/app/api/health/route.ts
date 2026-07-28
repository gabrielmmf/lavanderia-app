import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAuthorizedCronRequest } from "@/lib/cron-auth"
import { databaseEndpointId } from "@/lib/database-info"
import { errorMessage } from "@/lib/api-errors"
import { ensureVapidConfigured } from "@/lib/notification-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Health check do deploy.
 *
 * Sem autenticação devolve apenas se a aplicação está de pé e alcança o banco.
 * Com `Authorization: Bearer <CRON_SECRET>` acrescenta qual compute endpoint do
 * Neon está em uso — é assim que o CI comprova que um preview fala com a branch
 * do pull request e não com produção. Os detalhes de infraestrutura ficam atrás
 * do segredo porque o app em si é público e não tem login.
 */
export async function GET(request: Request) {
  const detailed = isAuthorizedCronRequest(request)

  let reachable = false
  let schemaUpToDate = false
  let detail: string | undefined

  try {
    // `PushSubscription` só existe a partir da migration `add_web_push`:
    // consultá-la prova, de uma vez, que o banco responde e que as migrations
    // deste código foram aplicadas no banco que este deploy está usando.
    await prisma.pushSubscription.count()
    reachable = true
    schemaUpToDate = true
  } catch (error) {
    detail = errorMessage(error)
    try {
      await prisma.booking.count()
      reachable = true // banco responde, mas está numa versão antiga do schema
    } catch {
      reachable = false
    }
  }

  const ok = reachable && schemaUpToDate

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      // Deliberadamente fora do `ok`: sem VAPID o app continua íntegro, só sem
      // notificações — é o comportamento documentado. Mas o estado precisa
      // aparecer em algum lugar, senão uma chave inválida em produção só é
      // descoberta por um morador clicando num botão que nunca funciona.
      notifications: { configured: ensureVapidConfigured() },
      database: {
        reachable,
        schemaUpToDate,
        ...(detailed
          ? {
              endpoint: databaseEndpointId(process.env.DATABASE_URL),
              detail,
            }
          : {}),
      },
    },
    { status: ok ? 200 : 503 }
  )
}
