import webPush, { type PushSubscription as WebPushSubscription } from "web-push"
import { prisma } from "./prisma"
import { NOTIFICATION_LEAD_MINUTES, normalizeVapidPublicKey } from "./notifications-config"

/** Assunto exigido pelo protocolo VAPID (mailto: ou URL). */
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@lavanderia.app"

let vapidConfigured = false

/**
 * Configura o web-push sob demanda.
 *
 * Deliberadamente NÃO fazemos isso no topo do módulo: `setVapidDetails` lança
 * se as chaves estiverem ausentes ou inválidas, o que quebraria o build e
 * qualquer import do módulo em ambientes sem as variáveis configuradas.
 */
export function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true

  // Mesma validação de formato do client: uma chave inválida aqui derrubaria o
  // ciclo inteiro com um erro genérico do web-push, difícil de ligar à causa.
  const publicKey = normalizeVapidPublicKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return false

  try {
    webPush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch (error) {
    console.error("Chaves VAPID inválidas:", error)
    return false
  }
}

export type NotificationRunResult = {
  /** Notificações entregues com sucesso. */
  sent: number
  /** Notificações que falharam na entrega. */
  failed: number
  /** Inscrições removidas por estarem expiradas (HTTP 404/410). */
  pruned: number
  /** Agendamentos marcados como notificados. */
  bookingsMarked: number
}

type PendingPush = {
  bookingId: string
  endpoint: string
  subscription: WebPushSubscription
  payload: string
}

function isGoneStatus(reason: unknown): boolean {
  const statusCode = (reason as { statusCode?: number } | undefined)?.statusCode
  return statusCode === 404 || statusCode === 410
}

/**
 * Envia as notificações de início e término que entram na janela de
 * `NOTIFICATION_LEAD_MINUTES` e marca os agendamentos correspondentes.
 *
 * Idempotente: agendamentos já marcados são ignorados, e um agendamento só é
 * marcado quando pelo menos uma notificação foi entregue com sucesso — assim
 * uma falha temporária de rede não faz o aviso ser perdido para sempre.
 */
export async function runNotificationCycle(
  now: Date = new Date()
): Promise<NotificationRunResult> {
  const empty: NotificationRunResult = { sent: 0, failed: 0, pruned: 0, bookingsMarked: 0 }

  if (!ensureVapidConfigured()) {
    console.warn("VAPID não configurado — ciclo de notificações ignorado.")
    return empty
  }

  const horizon = new Date(now.getTime() + NOTIFICATION_LEAD_MINUTES * 60_000)

  const [upcomingStarts, upcomingEnds] = await Promise.all([
    prisma.booking.findMany({
      where: { startNotified: false, startTime: { gt: now, lte: horizon } },
    }),
    prisma.booking.findMany({
      where: { endNotified: false, endTime: { gt: now, lte: horizon } },
    }),
  ])

  if (upcomingStarts.length === 0 && upcomingEnds.length === 0) return empty

  // Uma única consulta para todas as inscrições envolvidas (evita N+1).
  const apartments = Array.from(
    new Set([...upcomingStarts, ...upcomingEnds].map((b) => b.apartmentNumber))
  )
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { apartmentNumber: { in: apartments } },
  })

  const byApartment = new Map<string, typeof subscriptions>()
  for (const subscription of subscriptions) {
    const list = byApartment.get(subscription.apartmentNumber) ?? []
    list.push(subscription)
    byApartment.set(subscription.apartmentNumber, list)
  }

  const pending: PendingPush[] = []

  function enqueue(
    booking: { id: string; apartmentNumber: string; machineNumber: number },
    title: string,
    body: string
  ) {
    for (const subscription of byApartment.get(booking.apartmentNumber) ?? []) {
      pending.push({
        bookingId: booking.id,
        endpoint: subscription.endpoint,
        subscription: {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload: JSON.stringify({ title, body, url: "/" }),
      })
    }
  }

  for (const booking of upcomingStarts) {
    enqueue(
      booking,
      "Lavanderia: seu horário vai começar",
      `Sua reserva na máquina ${booking.machineNumber} começa em ${NOTIFICATION_LEAD_MINUTES} minutos.`
    )
  }
  for (const booking of upcomingEnds) {
    enqueue(
      booking,
      "Lavanderia: seu horário está acabando",
      `Sua reserva na máquina ${booking.machineNumber} termina em ${NOTIFICATION_LEAD_MINUTES} minutos. Prepare-se para retirar as roupas.`
    )
  }

  const results = await Promise.allSettled(
    pending.map((push) => webPush.sendNotification(push.subscription, push.payload))
  )

  const deliveredBookingIds = new Set<string>()
  const staleEndpoints = new Set<string>()
  let sent = 0
  let failed = 0

  results.forEach((result, index) => {
    const push = pending[index]
    if (result.status === "fulfilled") {
      sent++
      deliveredBookingIds.add(push.bookingId)
      return
    }
    failed++
    if (isGoneStatus(result.reason)) {
      staleEndpoints.add(push.endpoint)
      // Inscrição morta não impede o agendamento de ser considerado tratado.
      deliveredBookingIds.add(push.bookingId)
    } else {
      console.error("Falha ao enviar notificação:", result.reason)
    }
  })

  if (staleEndpoints.size > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: Array.from(staleEndpoints) } },
    })
  }

  const startIds = upcomingStarts.filter((b) => deliveredBookingIds.has(b.id)).map((b) => b.id)
  const endIds = upcomingEnds.filter((b) => deliveredBookingIds.has(b.id)).map((b) => b.id)

  const [startUpdate, endUpdate] = await Promise.all([
    startIds.length
      ? prisma.booking.updateMany({
          where: { id: { in: startIds } },
          data: { startNotified: true },
        })
      : Promise.resolve({ count: 0 }),
    endIds.length
      ? prisma.booking.updateMany({
          where: { id: { in: endIds } },
          data: { endNotified: true },
        })
      : Promise.resolve({ count: 0 }),
  ])

  return {
    sent,
    failed,
    pruned: staleEndpoints.size,
    bookingsMarked: startUpdate.count + endUpdate.count,
  }
}
