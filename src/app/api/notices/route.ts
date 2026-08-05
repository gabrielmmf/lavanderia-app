import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const notices = await prisma.notice.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(notices)
  } catch {
    return NextResponse.json({ error: "Erro ao buscar avisos" }, { status: 500 })
  }
}
