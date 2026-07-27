import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { subscription, apartmentNumber } = await req.json()

    if (!subscription || !subscription.endpoint || !apartmentNumber) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    const { endpoint, keys } = subscription

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        apartmentNumber,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        apartmentNumber,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
