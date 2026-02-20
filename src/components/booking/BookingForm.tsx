"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DateTimePicker } from "./DateTimePicker"

function getDefaultStart(): Date {
  const d = new Date()
  const now = d.getTime()
  d.setHours(8, 0, 0, 0)
  if (d.getTime() <= now) {
    d.setTime(now)
    const m = d.getMinutes()
    d.setMinutes(m <= 30 ? 30 : 60, 0, 0)
  }
  return d
}

function getDefaultEnd(): Date {
  const start = getDefaultStart()
  const d = new Date(start)
  d.setMinutes(d.getMinutes() + 120, 0, 0)
  return d
}

const MACHINES = [1, 2, 3] as const

export function BookingForm({
    apartment,
    onApartmentChange,
    onCreated,
}: {
    apartment: string
    onApartmentChange: (value: string) => void
    onCreated: () => void
}) {
    const [machine, setMachine] = useState<number>(1)
    const [start, setStart] = useState<Date>(getDefaultStart)
    const [end, setEnd] = useState<Date>(getDefaultEnd)
    const [loading, setLoading] = useState(false)
    const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<{
        apartmentNumber: string
        machineNumber: number
        startTime: string
        endTime: string
    } | null>(null)

    const MAX_HOURS = 12

    useEffect(() => {
        if (end <= start) {
            const next = new Date(start)
            next.setMinutes(next.getMinutes() + 30)
            setEnd(next)
        } else {
            const maxEnd = new Date(start)
            maxEnd.setHours(maxEnd.getHours() + MAX_HOURS, 0, 0, 0)
            if (end > maxEnd) setEnd(maxEnd)
        }
    }, [start, end])

    async function doSubmit(payload: {
        apartmentNumber: string
        machineNumber: number
        startTime: string
        endTime: string
        replaceOldest: boolean
    }) {
        const res = await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok) {
            if (res.status === 409 && data.code === "BookingLimitError") {
                setPendingData({
                    apartmentNumber: payload.apartmentNumber,
                    machineNumber: payload.machineNumber,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                })
                setShowReplaceConfirm(true)
                return
            }
            alert(data.error)
            return
        }

        setPendingData(null)
        setShowReplaceConfirm(false)
        setMachine(1)
        setStart(getDefaultStart())
        setEnd(getDefaultEnd())
        onCreated()
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        await doSubmit({
            apartmentNumber: apartment,
            machineNumber: machine,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            replaceOldest: false,
        })
        setLoading(false)
    }

    async function handleConfirmReplace() {
        if (!pendingData) return
        setLoading(true)
        setShowReplaceConfirm(false)
        await doSubmit({
            ...pendingData,
            replaceOldest: true,
        })
        setPendingData(null)
        setLoading(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Novo Agendamento</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">

                    <div className="space-y-2">
                        <Label>Apartamento</Label>
                        <Input
                            value={apartment}
                            onChange={e => onApartmentChange(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Máquina</Label>
                        <select
                            value={machine}
                            onChange={e => setMachine(Number(e.target.value))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {MACHINES.map((n) => (
                                <option key={n} value={n}>Máquina {n}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>Início</Label>
                        <DateTimePicker
                            value={start}
                            onChange={setStart}
                            min={new Date()}
                            placeholder="Selecione data e hora de início"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Fim</Label>
                        <DateTimePicker
                            value={end}
                            onChange={setEnd}
                            min={start}
                            placeholder="Selecione data e hora de fim"
                        />
                    </div>

                    <Button className="w-full" disabled={loading}>
                        {loading ? "Agendando..." : "Agendar"}
                    </Button>
                </form>

                <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Limite de agendamentos</AlertDialogTitle>
                            <AlertDialogDescription>
                                O apartamento {apartment} já possui 2 agendamentos. O agendamento mais antigo será removido para permitir este novo. Deseja continuar?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmReplace}>
                                Sim, substituir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}
