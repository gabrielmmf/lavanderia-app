import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    // O admin pode deletar ignorando regras de efetivação.
    await prisma.booking.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro ao deletar agendamento" }, { status: 500 })
  }
}
