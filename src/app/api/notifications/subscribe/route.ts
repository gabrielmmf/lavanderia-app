import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse } from "@/lib/api-errors"

export const runtime = "nodejs"

type SubscribeBody = {
  apartmentNumber?: unknown
  subscription?: {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }
}

export async function POST(request: Request) {
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
