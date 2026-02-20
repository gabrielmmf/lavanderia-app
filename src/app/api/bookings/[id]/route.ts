import { NextResponse } from "next/server"
import { deleteBooking } from "@/lib/booking-service"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteBooking(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message === "Agendamento não encontrado" ? 404 : 400 }
    )
  }
}
