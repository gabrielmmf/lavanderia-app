"use client"

import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useNotifications } from "@/lib/useNotifications"

export function NotificationToggle({ apartmentNumber }: { apartmentNumber: string }) {
  const { permission, isSubscribed, requestPermission, unsubscribe } = useNotifications();

  if (permission === 'denied') {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" disabled title="Notificações bloqueadas pelo navegador">
        <BellOff className="h-4 w-4 mr-2" />
        Bloqueadas
      </Button>
    )
  }

  if (isSubscribed) {
    return (
      <Button variant="ghost" size="sm" className="text-primary" onClick={unsubscribe} title="Clique para desativar neste dispositivo">
        <Bell className="h-4 w-4 mr-2" />
        Ativadas (Desativar)
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => requestPermission(apartmentNumber)}>
      <Bell className="h-4 w-4 mr-2" />
      Ativar Notificações
    </Button>
  )
}
