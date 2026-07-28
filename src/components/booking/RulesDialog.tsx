"use client"

import { useState, useSyncExternalStore } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  BOOKING_WINDOW_DAYS,
  EFFECTUATION_LEAD_LABEL,
  MAX_APARTMENT_BOOKINGS,
  MAX_APARTMENT_BOOKINGS_PER_WINDOW,
} from "@/lib/booking-rules"

const SESSION_KEY = "lavanderia-rules-seen"

const seenListeners = new Set<() => void>()

function subscribeSeen(onStoreChange: () => void) {
  seenListeners.add(onStoreChange)
  return () => {
    seenListeners.delete(onStoreChange)
  }
}

function getSeenSnapshot(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null
  } catch {
    return true // storage bloqueado: não force o diálogo
  }
}

/** No servidor consideramos "já visto" para não abrir o diálogo antes da hidratação. */
function getServerSeenSnapshot(): boolean {
  return true
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1")
  } catch {
    // ignora storage indisponível
  }
  for (const listener of seenListeners) listener()
}

type RulesDialogProps = {
  trigger?: React.ReactNode
}

export function RulesDialog({ trigger }: RulesDialogProps) {
  // `seen` vem do sessionStorage (external store) em vez de setState num efeito.
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getServerSeenSnapshot)
  const [manuallyOpened, setManuallyOpened] = useState(false)

  const open = manuallyOpened || !seen

  function setOpen(next: boolean) {
    if (next) {
      setManuallyOpened(true)
      return
    }
    setManuallyOpened(false)
    markSeen()
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          aria-label="Ver regras"
        >
          {trigger}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como funciona a Lavanderia</DialogTitle>
            <DialogDescription>
              Conheça as regras e limites para agendar o uso das máquinas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground">
            <section>
              <h3 className="font-semibold mb-2">📅 Fazendo um agendamento</h3>
              <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                <li>Informe seu apartamento, escolha a máquina (1, 2 ou 3) e o horário desejado.</li>
                <li>Seu apartamento será lembrado na próxima vez que você abrir o app.</li>
                <li>Você pode agendar com antecedência, mas não para horários que já passaram.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">⏱️ Limite de tempo</h3>
              <p className="text-muted-foreground">
                Cada agendamento pode ter no máximo <strong>8 horas</strong> de uso. Por exemplo: das 8h às 16h.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">🏠 Limite por apartamento</h3>
              <p className="text-muted-foreground">
                Cada apartamento pode ter até <strong>{MAX_APARTMENT_BOOKINGS} agendamentos</strong> ao mesmo tempo. Se você tentar agendar mais um além do limite, o sistema pedirá sua confirmação para <strong>remover o agendamento mais antigo</strong> e criar o novo.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">📆 Limite semanal</h3>
              <p className="text-muted-foreground">
                Cada apartamento pode iniciar no máximo <strong>{MAX_APARTMENT_BOOKINGS_PER_WINDOW} agendamentos a cada {BOOKING_WINDOW_DAYS} dias</strong>, para garantir que todo mundo consiga usar a lavanderia. Se você atingir o limite, o sistema informa a partir de quando o agendamento mais antigo sai da contagem e libera espaço para um novo.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">🔒 Agendamentos efetivados</h3>
              <p className="text-muted-foreground">
                A partir de <strong>{EFFECTUATION_LEAD_LABEL}</strong> antes do início — e enquanto estiver em andamento ou já tiver terminado — um agendamento é considerado <strong>efetivado</strong> e não pode mais ser apagado. Isso evita que alguém apague um agendamento já em uso só para conseguir marcar outro em seguida.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">🔒 Horários da máquina</h3>
              <p className="text-muted-foreground">
                A mesma máquina não pode ser usada por duas pessoas ao mesmo tempo. Se o horário que você escolheu já estiver ocupado, o sistema avisará e você precisará escolher outro.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">🗑️ Excluindo agendamentos</h3>
              <p className="text-muted-foreground">
                Você só pode excluir os agendamentos do <strong>seu apartamento</strong>. O número do apartamento deve estar preenchido no formulário acima para o botão de excluir aparecer nos seus agendamentos no calendário.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">🔄 Limpeza automática</h3>
              <p className="text-muted-foreground">
                Agendamentos antigos (cujo horário já terminou) são removidos automaticamente do sistema para liberar espaço.
              </p>
            </section>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
