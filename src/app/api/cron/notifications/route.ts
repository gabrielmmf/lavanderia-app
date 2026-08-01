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

    // Sem VAPID o ciclo não tem como enviar nada. Responder 200 aqui é o que
    // fez o problema passar despercebido: o workflow ficava verde enquanto as
    // notificações estavam desligadas em produção. 503 pinta o cron de
    // vermelho, que é a única forma de alguém ficar sabendo.
    if (!result.vapidConfigured) {
      return NextResponse.json(
        {
          success: false,
          error:
            "VAPID não configurado: confira NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY neste ambiente.",
          ...result,
        },
        { status: 503 }
      )
    }

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
