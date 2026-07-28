import { NextResponse } from "next/server"
import {
  createBooking,
  listBookingsByDate,
  listAllBookings,
  deleteExpiredBookings,
  BookingLimitError,
  BookingLockedError,
  BookingWeeklyLimitError,
} from "@/lib/booking-service"
import { errorResponse } from "@/lib/api-errors"

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
  } catch (error) {
    let status = 400
    if (error instanceof BookingLimitError || error instanceof BookingLockedError) {
      status = 409
    } else if (error instanceof BookingWeeklyLimitError) {
      status = 429
    }
    return errorResponse(error, status)
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