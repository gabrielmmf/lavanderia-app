"use client"

import { useState, useEffect } from "react"
import { BookingForm } from "@/components/booking/BookingForm"
import { BookingList } from "@/components/booking/BookingList"
import { RulesDialog } from "@/components/booking/RulesDialog"
import { Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getStoredApartment, setStoredApartment } from "@/lib/apartment-storage"

export default function Home() {
  const [refresh, setRefresh] = useState(0)
  const [apartment, setApartment] = useState("")

  useEffect(() => {
    setApartment(getStoredApartment())
  }, [])

  useEffect(() => {
    if (apartment) setStoredApartment(apartment)
  }, [apartment])

  return (
    <main className="min-h-screen bg-muted p-4 pt-6 sm:p-6 pb-8 safe-area-padding">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

        <Card className="rounded-xl">
          <CardContent className="p-4 sm:p-6 flex items-center justify-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-center">
              Studio 733 - Lavanderia
            </h1>
            <RulesDialog trigger={<Info className="h-5 w-5 shrink-0" />} />
          </CardContent>
        </Card>

        <BookingForm
          apartment={apartment}
          onApartmentChange={setApartment}
          onCreated={() => setRefresh(prev => prev + 1)}
        />
        <BookingList refresh={refresh} currentApartment={apartment.trim()} />
      </div>
    </main>
  )
}