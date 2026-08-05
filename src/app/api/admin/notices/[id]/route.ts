import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { isActive } = await request.json()
    const notice = await prisma.notice.update({
      where: { id: params.id },
      data: { isActive },
    })
    return NextResponse.json(notice)
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar aviso" }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await prisma.notice.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro ao deletar aviso" }, { status: 500 })
  }
}
