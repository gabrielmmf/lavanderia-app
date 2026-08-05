"use client"

import { useEffect, useState, useMemo } from "react"
import { BookingCard } from "./BookingCard"
import { Card } from "@/components/ui/card"
import { formatDateBR } from "@/lib/date-utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type Booking = {
  id: string
  apartmentNumber: string
  machineNumber: number
  startTime: string
  endTime: string
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return days
}

function getCalendarGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const days = getDaysInMonth(year, month)

  const grid: (Date | null)[][] = []
  let week: (Date | null)[] = Array(7).fill(null)

  for (let i = 0; i < startPad; i++) {
    week[i] = null
  }

  let w = startPad
  for (const d of days) {
    week[w] = d
    w++
    if (w === 7) {
      grid.push([...week])
      week = Array(7).fill(null)
      w = 0
    }
  }
  if (w > 0) grid.push(week)
  return grid
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function BookingList({
  refresh,
  onRefresh,
  currentApartment,
  isAdmin,
}: {
  refresh?: number
  onRefresh?: () => void
  currentApartment?: string
  isAdmin?: boolean
}) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [viewDate, setViewDate] = useState(new Date())

  function loadBookings() {
    const endpoint = isAdmin ? "/api/admin/bookings" : "/api/bookings"
    fetch(endpoint)
      .then(res => res.json())
      .then(setBookings)
  }

  useEffect(() => {
    loadBookings()
  }, [refresh])

  async function handleDelete(id: string) {
    const endpoint = isAdmin ? `/api/admin/bookings/${id}` : `/api/bookings/${id}`
    const res = await fetch(endpoint, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || "Erro ao excluir")
      return
    }
    setBookings(prev => prev.filter(b => b.id !== id))
    onRefresh?.()
  }

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const b of bookings) {
      const d = new Date(b.startTime)
      const key = formatDateBR(d)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    return map
  }, [bookings])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1))

  return (
    <Card className="p-4 sm:p-6 -mx-2 sm:mx-0 rounded-none sm:rounded-xl">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Calendário de Agendamentos</h2>

      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Mês anterior" className="size-10 sm:size-9 shrink-0 touch-manipulation">
          <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <span className="font-medium text-sm sm:text-base truncate">
          {MONTH_NAMES[month]} {year}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Próximo mês" className="size-10 sm:size-9 shrink-0 touch-manipulation">
          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[320px] border-collapse">
          <thead>
            <tr className="text-muted-foreground text-xs sm:text-sm">
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Dom</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Seg</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Ter</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Qua</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Qui</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Sex</th>
              <th className="border p-1.5 sm:p-2 w-10 sm:w-12">Sáb</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, i) => (
              <tr key={i}>
                {row.map((day, j) => {
                  if (!day) {
                    return <td key={j} className="border p-1 sm:p-1.5 min-h-[72px] sm:min-h-24 bg-muted/30" />
                  }
                  const key = formatDateBR(day)
                  const dayBookings = groupedByDate.get(key) ?? []
                  const isToday = sameDay(day, new Date())

                  return (
                    <td
                      key={j}
                      className={`border p-1 sm:p-1.5 align-top min-h-[72px] sm:min-h-24 ${
                        isToday ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-medium mb-1 sm:mb-1.5">{day.getDate()}</div>
                      <div className="space-y-1.5">
                        {dayBookings.map((b) => (
                          <BookingCard
                            key={b.id}
                            booking={b}
                            compact
                            onDelete={
                              isAdmin || (currentApartment &&
                              b.apartmentNumber.trim().toLowerCase() ===
                                currentApartment.trim().toLowerCase())
                                ? handleDelete
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bookings.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center py-4">
          Nenhum agendamento cadastrado.
        </p>
      )}
    </Card>
  )
}
