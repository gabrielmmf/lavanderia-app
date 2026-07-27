import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import webPush from "web-push"

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!

webPush.setVapidDetails(
  "https://lavanderia-app.vercel.app", // Pode ser mailto: ou url. É obrigatório pelo protocolo VAPID.
  publicVapidKey,
  privateVapidKey
)

export async function GET(req: Request) {
  try {
    const now = new Date()
    // Look ahead 15 minutes
    const future = new Date(now.getTime() + 15 * 60000)

    // Find bookings starting soon that weren't notified
    const upcomingStarts = await prisma.booking.findMany({
      where: {
        startNotified: false,
        startTime: {
          gt: now,
          lte: future
        }
      }
    })

    // Find bookings ending soon that weren't notified
    const upcomingEnds = await prisma.booking.findMany({
      where: {
        endNotified: false,
        endTime: {
          gt: now,
          lte: future
        }
      }
    })

    const notificationsToSend: any[] = []

    for (const booking of upcomingStarts) {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { apartmentNumber: booking.apartmentNumber }
      })
      for (const sub of subscriptions) {
        notificationsToSend.push({
          subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload: JSON.stringify({
            title: "Lavanderia: Início Próximo!",
            body: `Sua reserva na máquina ${booking.machineNumber} começará em breve.`
          }),
        })
      }
    }

    for (const booking of upcomingEnds) {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { apartmentNumber: booking.apartmentNumber }
      })
      for (const sub of subscriptions) {
        notificationsToSend.push({
          subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload: JSON.stringify({
            title: "Lavanderia: Término Próximo!",
            body: `Sua reserva na máquina ${booking.machineNumber} terminará em breve. Por favor, prepare-se para retirar as roupas.`
          }),
        })
      }
    }

    const results = await Promise.allSettled(
      notificationsToSend.map(n => webPush.sendNotification(n.subscription, n.payload))
    )

    // Delete subscriptions that resulted in Gone (unsubscribed)
    results.forEach((result, index) => {
      if (result.status === 'rejected' && result.reason.statusCode === 410) {
        const endpoint = notificationsToSend[index].subscription.endpoint;
        // Run in background to not block
        prisma.pushSubscription.delete({ where: { endpoint } }).catch(console.error);
      }
    });

    // Mark as notified in DB
    const startIds = upcomingStarts.map(b => b.id)
    if (startIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: startIds } },
        data: { startNotified: true }
      })
    }

    const endIds = upcomingEnds.map(b => b.id)
    if (endIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: endIds } },
        data: { endNotified: true }
      })
    }

    return NextResponse.json({ success: true, processed: results.length })
  } catch (error) {
    console.error("Cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
