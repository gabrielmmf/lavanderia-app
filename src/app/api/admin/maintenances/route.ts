import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const maintenances = await prisma.maintenance.findMany({
      orderBy: { startTime: "desc" },
    })
    return NextResponse.json(maintenances)
  } catch {
    return NextResponse.json({ error: "Erro ao buscar manutenções" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    const machineNumber = Number(data.machineNumber)

    if (isNaN(machineNumber) || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    if (startTime >= endTime) {
      return NextResponse.json({ error: "Horário inválido" }, { status: 400 })
    }

    // Opcional: Impedir sobreposição de manutenções
    const conflict = await prisma.maintenance.findFirst({
      where: {
        machineNumber,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    })

    if (conflict) {
      return NextResponse.json({ error: "Já existe uma manutenção agendada para este horário." }, { status: 400 })
    }

    const maintenance = await prisma.maintenance.create({
      data: {
        machineNumber,
        startTime,
        endTime,
        reason: data.reason || null,
      },
    })
    return NextResponse.json(maintenance)
  } catch {
    return NextResponse.json({ error: "Erro ao criar manutenção" }, { status: 500 })
  }
}
