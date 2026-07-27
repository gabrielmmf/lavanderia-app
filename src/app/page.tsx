"use client"

import { useState, useEffect } from "react"
import { BookingForm } from "@/components/booking/BookingForm"
import { BookingList } from "@/components/booking/BookingList"
import { RulesDialog } from "@/components/booking/RulesDialog"
import { Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getStoredApartment, setStoredApartment } from "@/lib/apartment-storage"
import { NotificationToggle } from "@/components/booking/NotificationToggle"
import { useNotifications } from "@/lib/useNotifications"
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
export default function Home() {
  const [refresh, setRefresh] = useState(0)
  const [apartment, setApartment] = useState("")
  const { permission, requestPermission } = useNotifications()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    setApartment(getStoredApartment())
  }, [])

  useEffect(() => {
    if (apartment) setStoredApartment(apartment)
  }, [apartment])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (permission === 'default') {
        setShowPrompt(true)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [permission])

  return (
    <main className="min-h-screen bg-muted p-4 pt-6 sm:p-6 pb-8 safe-area-padding">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

        <Card className="rounded-xl">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-center">
                Studio 733 - Lavanderia
              </h1>
              <RulesDialog trigger={<Info className="h-5 w-5 shrink-0 cursor-pointer" />} />
            </div>
            <NotificationToggle apartmentNumber={apartment} />
          </CardContent>
        </Card>

        <BookingForm
          apartment={apartment}
          onApartmentChange={setApartment}
          onCreated={() => setRefresh(prev => prev + 1)}
        />
        <BookingList refresh={refresh} currentApartment={apartment.trim()} />
      </div>

      <AlertDialog open={showPrompt} onOpenChange={setShowPrompt}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Deseja receber notificações?</AlertDialogTitle>
                <AlertDialogDescription>
                    Podemos avisar você 10 minutos antes do seu horário começar e terminar.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Agora não</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    requestPermission(apartment);
                    setShowPrompt(false);
                }}>
                    Sim, ativar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}