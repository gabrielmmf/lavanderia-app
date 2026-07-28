import { NextResponse } from "next/server"
import { runNotificationCycle } from "@/lib/notification-service"
import { isAuthorizedCronRequest } from "@/lib/cron-auth"
import { errorMessage } from "@/lib/api-errors"

// web-push depende de APIs de crypto do Node — o runtime edge não serve.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const result = await runNotificationCycle()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Erro no cron de notificações:", error)
    return NextResponse.json(
      { error: "Erro interno", detail: errorMessage(error) },
      { status: 500 }
    )
  }
}

/** Mesma execução via POST, para agendadores que só disparam POST. */
export const POST = GET
