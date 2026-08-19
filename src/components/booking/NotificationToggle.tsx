"use client"

import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useNotifications } from "@/lib/useNotifications"

export function NotificationToggle({ apartmentNumber }: { apartmentNumber: string }) {
  const {
    permission,
    isSubscribed,
    isSupported,
    isConfigured,
    isEnabled,
    error,
    requestPermission,
    unsubscribe,
  } = useNotifications()

  // Sem suporte do navegador não há o que oferecer — não renderiza nada.
  if (!isSupported) return null

  return (
    <div className="flex flex-col items-end gap-1">
      {/*
        Dois estados desativados, por motivos diferentes, e a ordem importa:
        `isEnabled` vem primeiro porque é uma decisão nossa e explica o caso
        mesmo que a chave VAPID também esteja faltando.

        "Desativadas" — desligamos de propósito (ver `NOTIFICATIONS_ENABLED`).
        Sumir da tela seria pior: os avisos param de chegar de um jeito que o
        morador percebe, e sem nada escrito ele conclui que o app quebrou.

        "Indisponíveis" — sem chave VAPID válida a inscrição é impossível, e
        oferecer o botão levaria o morador a um erro garantido a cada clique.
        O estado desativado diz a verdade, e é visível o bastante para quem
        cuida do deploy notar.
      */}
      {!isEnabled ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled
          title="As notificações estão temporariamente desativadas"
        >
          <BellOff className="h-4 w-4 mr-2" />
          Desativadas
        </Button>
      ) : !isConfigured ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled
          title="Notificações indisponíveis: a chave VAPID deste deploy está ausente ou inválida"
        >
          <BellOff className="h-4 w-4 mr-2" />
          Indisponíveis
        </Button>
      ) : permission === "denied" ? (
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
