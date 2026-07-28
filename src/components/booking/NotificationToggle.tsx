"use client"

import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useNotifications } from "@/lib/useNotifications"

export function NotificationToggle({ apartmentNumber }: { apartmentNumber: string }) {
  const { permission, isSubscribed, isSupported, error, requestPermission, unsubscribe } =
    useNotifications()

  // Sem suporte do navegador não há o que oferecer — não renderiza nada.
  if (!isSupported) return null

  return (
    <div className="flex flex-col items-end gap-1">
      {permission === "denied" ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled
          title="Notificações bloqueadas nas configurações do navegador"
        >
          <BellOff className="h-4 w-4 mr-2" />
          Bloqueadas
        </Button>
      ) : isSubscribed ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={() => void unsubscribe()}
          title="Clique para desativar neste dispositivo"
        >
          <Bell className="h-4 w-4 mr-2" />
          Ativadas (desativar)
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void requestPermission(apartmentNumber)}
        >
          <Bell className="h-4 w-4 mr-2" />
          Ativar notificações
        </Button>
      )}

      {error && (
        <p role="status" className="text-xs text-destructive max-w-56 text-right">
          {error}
        </p>
      )}
    </div>
  )
}
