import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse } from "@/lib/api-errors"
import { NOTIFICATIONS_ENABLED } from "@/lib/notifications-config"

export const runtime = "nodejs"

/**
 * Recusa antes de qualquer acesso ao banco quando as notificações estão
 * desligadas. Gravar (ou apagar) uma inscrição que nunca será usada acordaria o
 * compute do Neon por 5 minutos — ver `NOTIFICATIONS_ENABLED`.
 */
function disabledResponse() {
  return NextResponse.json(
    { error: "Notificações estão desativadas neste deploy." },
    { status: 503 }
  )
}

export async function POST(request: Request) {
  if (!NOTIFICATIONS_ENABLED) return disabledResponse()

  try {
    const body = (await request.json()) as { endpoint?: unknown }
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint é obrigatório" }, { status: 400 })
    }

    const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint } })

    return NextResponse.json({ success: true, removed: count })
  } catch (error) {
    console.error("Erro ao remover inscrição push:", error)
    return errorResponse(error, 500)
  }
}
