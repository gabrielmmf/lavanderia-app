import { NextResponse } from "next/server"
import {
  createBooking,
  listBookingsByDate,
  listAllBookings,
  deleteExpiredBookings,
  BookingLimitError,
} from "@/lib/booking-service"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const booking = await createBooking({
      apartmentNumber: body.apartmentNumber,
      machineNumber: Number(body.machineNumber),
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      replaceOldest: body.replaceOldest === true,
    })

    return NextResponse.json(booking)
  } catch (error: any) {
    const status = error instanceof BookingLimitError ? 409 : 400
    return NextResponse.json(
      { error: error.message, code: error.name },
      { status }
    )
  }
}

export async function GET(req: Request) {
  await deleteExpiredBookings()

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")

  if (!date) {
    const bookings = await listAllBookings()
    return NextResponse.json(bookings)
  }

  const bookings = await listBookingsByDate(new Date(date))
  return NextResponse.json(bookings)
}