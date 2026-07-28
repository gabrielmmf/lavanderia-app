import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse } from "@/lib/api-errors"

export const runtime = "nodejs"

export async function POST(request: Request) {
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
