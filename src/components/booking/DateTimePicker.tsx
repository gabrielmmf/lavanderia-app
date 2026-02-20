"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = ["00", "30"]

export function DateTimePicker({
  value,
  onChange,
  min,
  placeholder = "Selecione data e hora",
  className,
}: {
  value: Date
  onChange: (d: Date) => void
  min?: Date
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const hour = value.getHours()
  const minute = value.getMinutes()
  const minuteStr = minute === 30 ? "30" : "00"

  const setHour = (h: number) => {
    const d = new Date(value)
    d.setHours(h, minute, 0, 0)
    onChange(d)
  }

  const setMinute = (m: number) => {
    const d = new Date(value)
    d.setHours(hour, m, 0, 0)
    onChange(d)
  }

  const setDate = (d: Date | undefined) => {
    if (!d) return
    const next = new Date(value)
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
    onChange(next)
  }

  const displayValue = value
    ? format(value, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <Calendar
            mode="single"
            selected={value}
            onSelect={setDate}
            disabled={
              min
                ? (date) => {
                    const d = new Date(date)
                    d.setHours(0, 0, 0, 0)
                    const m = new Date(min)
                    m.setHours(0, 0, 0, 0)
                    return d < m
                  }
                : undefined
            }
            locale={ptBR}
            initialFocus
          />
        </div>
        <div className="p-3 flex items-center gap-2 border-t bg-muted/30">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}h
                </option>
              ))}
            </select>
            <select
              value={minuteStr}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  :{m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-2 border-t">
          <Button
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
