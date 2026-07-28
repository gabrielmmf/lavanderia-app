"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

/** Converte a chave VAPID pública (base64url) para o `Uint8Array` esperado pelo PushManager. */
// O `<ArrayBuffer>` explícito importa: `applicationServerKey` exige um
// ArrayBufferView com buffer não compartilhado, e o `Uint8Array` genérico
// (ArrayBufferLike) não satisfaz esse tipo.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/* --------------------------------------------------------------------------
 * Notification.permission é estado de plataforma (external store).
 * Ler via useSyncExternalStore evita setState síncrono dentro de efeito.
 * ------------------------------------------------------------------------ */

const permissionListeners = new Set<() => void>()

function emitPermissionChange() {
  for (const listener of permissionListeners) listener()
}

function subscribePermission(onStoreChange: () => void) {
  permissionListeners.add(onStoreChange)

  let status: PermissionStatus | undefined
  let cancelled = false

  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((result) => {
      if (cancelled) return
      status = result
      result.addEventListener("change", onStoreChange)
    })
    .catch(() => {
      // Alguns navegadores não suportam permissions.query({ name: "notifications" }).
    })

  return () => {
    cancelled = true
    permissionListeners.delete(onStoreChange)
    status?.removeEventListener("change", onStoreChange)
  }
}

function getPermissionSnapshot(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied"
  return Notification.permission
}

/** O servidor não conhece a permissão; "default" evita mismatch de hidratação. */
function getServerPermissionSnapshot(): NotificationPermission {
  return "default"
}

export type NotificationsApi = {
  /** Estado atual da permissão do navegador. */
  permission: NotificationPermission
  /** Se este dispositivo já possui uma inscrição push ativa. */
  isSubscribed: boolean
  /** Se o navegador suporta Web Push (Notification + Service Worker + PushManager). */
  isSupported: boolean
  /** Último erro legível, para exibição na UI. */
  error: string | null
  requestPermission: (apartmentNumber: string) => Promise<NotificationPermission>
  unsubscribe: () => Promise<void>
}

function browserSupportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

export function useNotifications(): NotificationsApi {
  const permission = useSyncExternalStore(
    subscribePermission,
    getPermissionSnapshot,
    getServerPermissionSnapshot
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!browserSupportsPush()) return
    // setState assíncrono (dentro de promise) — não dispara render em cascata.
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSupported(true)
        setIsSubscribed(Boolean(subscription))
      })
      .catch(() => {
        setIsSupported(true)
        setIsSubscribed(false)
      })
  }, [])

  const requestPermission = useCallback(
    async (apartmentNumber: string): Promise<NotificationPermission> => {
      setError(null)

      if (!browserSupportsPush()) {
        setError("Seu navegador não suporta notificações push.")
        return "denied"
      }
      if (!apartmentNumber.trim()) {
        setError("Preencha o número do apartamento antes de ativar as notificações.")
        return getPermissionSnapshot()
      }
      if (!publicVapidKey) {
        setError("Notificações indisponíveis: chave VAPID não configurada.")
        return getPermissionSnapshot()
      }

      const result = await Notification.requestPermission()
      emitPermissionChange()
      if (result !== "granted") return result

      try {
        const registration = await navigator.serviceWorker.register("/sw.js")
        const existing = await registration.pushManager.getSubscription()
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
          }))

        const response = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, apartmentNumber: apartmentNumber.trim() }),
        })
        if (!response.ok) throw new Error("Falha ao registrar a inscrição no servidor")

        setIsSubscribed(true)
      } catch (err) {
        console.error("Falha ao se inscrever no Web Push", err)
        setError("Não foi possível ativar as notificações. Tente novamente.")
      }

      return result
    },
    []
  )

  const unsubscribe = useCallback(async () => {
    if (!browserSupportsPush()) return
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const { endpoint } = subscription
        await subscription.unsubscribe()
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
      }
      setIsSubscribed(false)
    } catch (err) {
      console.error("Falha ao desativar notificações", err)
      setError("Não foi possível desativar as notificações.")
    }
  }, [])

  return { permission, isSubscribed, isSupported, error, requestPermission, unsubscribe }
}
