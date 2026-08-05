import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const notices = await prisma.notice.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(notices)
  } catch {
    return NextResponse.json({ error: "Erro ao buscar avisos" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { message, isActive } = await request.json()
    if (!message) {
      return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 })
    }
    const notice = await prisma.notice.create({
      data: { message, isActive: isActive ?? true },
    })
    return NextResponse.json(notice)
  } catch {
    return NextResponse.json({ error: "Erro ao criar aviso" }, { status: 500 })
  }
}
