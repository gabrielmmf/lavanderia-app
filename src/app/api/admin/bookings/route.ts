import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    let whereClause = {}
    if (dateParam) {
      const date = new Date(dateParam)
      if (!isNaN(date.getTime())) {
        const start = new Date(date)
        start.setHours(0, 0, 0, 0)
        const end = new Date(date)
        end.setHours(23, 59, 59, 999)
        whereClause = {
          startTime: {
            gte: start,
            lte: end,
          }
        }
      }
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { startTime: "desc" },
    })

    return NextResponse.json(bookings)
  } catch {
    return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 })
  }
}
