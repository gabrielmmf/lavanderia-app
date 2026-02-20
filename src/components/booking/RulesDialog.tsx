"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const SESSION_KEY = "lavanderia-rules-seen"

type RulesDialogProps = {
  trigger?: React.ReactNode
}

export function RulesDialog({ trigger }: RulesDialogProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = sessionStorage.getItem(SESSION_KEY)
    if (!seen) {
      setOpen(true)
    }
  }, [])

  function handleClose() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1")
    }
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
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) handleClose()
        }}
      >
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
              Cada agendamento pode ter no máximo <strong>12 horas</strong> de uso. Por exemplo: das 8h às 20h.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">🏠 Limite por apartamento</h3>
            <p className="text-muted-foreground">
              Cada apartamento pode ter até <strong>2 agendamentos</strong> ao mesmo tempo. Se você tentar agendar um terceiro, o sistema pedirá sua confirmação para <strong>remover o agendamento mais antigo</strong> e criar o novo.
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
