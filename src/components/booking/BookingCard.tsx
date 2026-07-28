"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { formatTimeBR, formatDateBR } from "@/lib/date-utils"
import { Trash2, Lock } from "lucide-react"
import { EFFECTUATION_LEAD_LABEL, isBookingEffectuated } from "@/lib/booking-rules"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type BookingCardProps = {
    booking: { id?: string; apartmentNumber: string; machineNumber?: number; startTime: string; endTime: string }
    compact?: boolean
    onDelete?: (id: string) => void | Promise<void>
}

export function BookingCard({ booking, compact, onDelete }: BookingCardProps) {
    const [showConfirm, setShowConfirm] = useState(false)

    const timeRange = `${formatTimeBR(booking.startTime)} até ${formatTimeBR(booking.endTime)}`
    const machineLabel = booking.machineNumber ? `M${booking.machineNumber}` : ""

    async function handleDelete() {
        if (!booking.id || !onDelete) return
        await onDelete(booking.id)
        setShowConfirm(false)
    }

    const effectuated = isBookingEffectuated(new Date(booking.startTime))
    const canDelete = booking.id && onDelete && !effectuated
    const locked = booking.id && onDelete && effectuated
    const lockedLabel = `Agendamento já efetivado — começa em menos de ${EFFECTUATION_LEAD_LABEL} (ou já começou) — e não pode mais ser apagado`

    if (compact) {
        return (
            <>
                <div className="flex items-center gap-2 text-xs bg-primary/10 rounded px-2 py-1.5 min-h-[44px]" title={timeRange}>
                    <span className="flex-1 min-w-0 truncate">
                        <strong>Ap {booking.apartmentNumber}</strong>
                        {machineLabel && <span> · {machineLabel}</span>} — {timeRange}
                    </span>
                    {canDelete && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowConfirm(true) }}
                            className="p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-destructive/20 active:bg-destructive/30 text-destructive shrink-0 touch-manipulation"
                            aria-label="Excluir agendamento"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                    {locked && (
                        <span
                            className="p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground shrink-0"
                            title={lockedLabel}
                            aria-label={lockedLabel}
                        >
                            <Lock className="h-4 w-4" />
                        </span>
                    )}
                </div>
                {canDelete && (
                    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Excluir agendamento do apartamento {booking.apartmentNumber} ({timeRange})?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <Button variant="destructive" onClick={handleDelete}>
                                    Excluir
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </>
        )
    }

    return (
        <Card>
            <CardContent className="py-3 text-sm flex items-start justify-between gap-2">
                <div>
                    <strong>Ap {booking.apartmentNumber}</strong>
                    {machineLabel && <span> · {machineLabel}</span>} — {timeRange}
                    <div className="text-muted-foreground text-xs mt-1">
                        {formatDateBR(booking.startTime)}
                    </div>
                </div>
                {canDelete && (
                    <>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-destructive/10 active:bg-destructive/20 text-destructive shrink-0 touch-manipulation"
                            aria-label="Excluir agendamento"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Excluir agendamento do apartamento {booking.apartmentNumber} ({timeRange})?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <Button variant="destructive" onClick={handleDelete}>
                                        Excluir
                                    </Button>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
                {locked && (
                    <span
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground shrink-0"
                        title={lockedLabel}
                        aria-label={lockedLabel}
                    >
                        <Lock className="h-4 w-4" />
                    </span>
                )}
            </CardContent>
        </Card>
    )
}
