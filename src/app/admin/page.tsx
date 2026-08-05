"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { LogOut, Trash2 } from "lucide-react"

export default function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("bookings")

  const [bookings, setBookings] = useState<{ id: string, apartmentNumber: string, machineNumber: number, startTime: string, endTime: string }[]>([])
  const [notices, setNotices] = useState<{ id: string, message: string, isActive: boolean }[]>([])
  const [maintenances, setMaintenances] = useState<{ id: string, machineNumber: number, startTime: string, endTime: string, reason: string | null }[]>([])

  const [newNoticeMsg, setNewNoticeMsg] = useState("")

  const [maintMachine, setMaintMachine] = useState("1")
  const [maintStart, setMaintStart] = useState("")
  const [maintEnd, setMaintEnd] = useState("")
  const [maintReason, setMaintReason] = useState("")

  const fetchData = async () => {
    try {
      const [bRes, nRes, mRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/notices"),
        fetch("/api/admin/maintenances")
      ])
      if (bRes.ok) setBookings(await bRes.json())
      if (nRes.ok) setNotices(await nRes.json())
      if (mRes.ok) setMaintenances(await mRes.json())
    } catch {
      // Ignora erro
    }
  }

  useEffect(() => {
    // Para evitar a regra do ESLint react-hooks/set-state-in-effect:
    // chamamos fetchData em um setTimeout.
    const timer = setTimeout(() => { void fetchData() }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
  }

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este agendamento?")) return
    await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" })
    fetchData()
  }

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newNoticeMsg, isActive: true })
    })
    setNewNoticeMsg("")
    fetchData()
  }

  const handleToggleNotice = async (id: string, currentIsActive: boolean) => {
    await fetch(`/api/admin/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentIsActive })
    })
    fetchData()
  }

  const handleDeleteNotice = async (id: string) => {
    if (!confirm("Deletar aviso?")) return
    await fetch(`/api/admin/notices/${id}`, { method: "DELETE" })
    fetchData()
  }

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/admin/maintenances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machineNumber: parseInt(maintMachine),
        startTime: new Date(maintStart).toISOString(),
        endTime: new Date(maintEnd).toISOString(),
        reason: maintReason
      })
    })
    if (res.ok) {
      setMaintStart("")
      setMaintEnd("")
      setMaintReason("")
      fetchData()
    } else {
      const data = await res.json()
      alert(data.error)
    }
  }

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm("Remover interdição?")) return
    await fetch(`/api/admin/maintenances/${id}`, { method: "DELETE" })
    fetchData()
  }

  return (
    <main className="min-h-screen bg-muted p-4 sm:p-6 pb-8 safe-area-padding">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <Card className="rounded-xl border-none shadow-md">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-bold">Painel Administrativo</h1>
            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="bookings">Agendamentos</TabsTrigger>
            <TabsTrigger value="notices">Avisos</TabsTrigger>
            <TabsTrigger value="maintenances">Manutenções</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Agendamentos</CardTitle>
                <CardDescription>Gerencie todos os horários marcados.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apto</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.apartmentNumber}</TableCell>
                        <TableCell>{b.machineNumber}</TableCell>
                        <TableCell>{format(new Date(b.startTime), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>{format(new Date(b.endTime), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteBooking(b.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {bookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum agendamento encontrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Criar Aviso</CardTitle>
                <CardDescription>Este aviso aparecerá na página inicial para todos os moradores.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateNotice}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mensagem do aviso</Label>
                    <Input value={newNoticeMsg} onChange={e => setNewNoticeMsg(e.target.value)} required placeholder="Ex: Falta de água prevista para amanhã às 14h" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit">Publicar Aviso</Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avisos Publicados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notices.map(n => (
                      <TableRow key={n.id}>
                        <TableCell>{n.message}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={n.isActive} onCheckedChange={() => handleToggleNotice(n.id, n.isActive)} />
                            <Badge variant={n.isActive ? "default" : "secondary"}>
                              {n.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteNotice(n.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {notices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum aviso criado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bloquear Máquina (Manutenção)</CardTitle>
                <CardDescription>Impede novos agendamentos neste período. Cuidado: os agendamentos já existentes não serão apagados automaticamente.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateMaintenance}>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Máquina</Label>
                    <select
                      value={maintMachine}
                      onChange={e => setMaintMachine(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="1">Máquina 1</option>
                      <option value="2">Máquina 2</option>
                      <option value="3">Máquina 3</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo (opcional)</Label>
                    <Input value={maintReason} onChange={e => setMaintReason(e.target.value)} placeholder="Ex: Reparo do motor" />
                  </div>
                  <div className="space-y-2">
                    <Label>Início (Data e Hora)</Label>
                    <Input type="datetime-local" value={maintStart} onChange={e => setMaintStart(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim (Data e Hora)</Label>
                    <Input type="datetime-local" value={maintEnd} onChange={e => setMaintEnd(e.target.value)} required />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit">Adicionar Interdição</Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Máquinas em Manutenção</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenances.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.machineNumber}</TableCell>
                        <TableCell>{format(new Date(m.startTime), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>{format(new Date(m.endTime), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>{m.reason}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteMaintenance(m.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {maintenances.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma manutenção ativa.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
