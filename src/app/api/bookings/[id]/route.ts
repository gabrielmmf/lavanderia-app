import { NextResponse } from "next/server"
import { deleteBooking, BookingNotFoundError } from "@/lib/booking-service"
import { errorResponse } from "@/lib/api-errors"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteBooking(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const status = error instanceof BookingNotFoundError ? 404 : 400
    return errorResponse(error, status)
  }
}
