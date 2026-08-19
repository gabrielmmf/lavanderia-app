import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse } from "@/lib/api-errors"
import { NOTIFICATIONS_ENABLED } from "@/lib/notifications-config"

export const runtime = "nodejs"

type SubscribeBody = {
  apartmentNumber?: unknown
  subscription?: {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }
}

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
    const body = (await request.json()) as SubscribeBody

    const apartmentNumber =
      typeof body.apartmentNumber === "string" ? body.apartmentNumber.trim() : ""
    const endpoint =
      typeof body.subscription?.endpoint === "string" ? body.subscription.endpoint : ""
    const p256dh =
      typeof body.subscription?.keys?.p256dh === "string" ? body.subscription.keys.p256dh : ""
    const auth =
      typeof body.subscription?.keys?.auth === "string" ? body.subscription.keys.auth : ""

    if (!apartmentNumber || !endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Inscrição inválida: apartamento, endpoint e chaves são obrigatórios" },
        { status: 400 }
      )
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { apartmentNumber, p256dh, auth },
      create: { apartmentNumber, endpoint, p256dh, auth },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao registrar inscrição push:", error)
    return errorResponse(error, 500)
  }
}
