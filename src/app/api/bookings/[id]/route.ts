import { NextResponse } from "next/server"
import { deleteBooking, BookingLockedError, BookingNotFoundError } from "@/lib/booking-service"
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
    let status = 400
    if (error instanceof BookingNotFoundError) {
      status = 404
    } else if (error instanceof BookingLockedError) {
      status = 409
    }
    return errorResponse(error, status)
  }
}
