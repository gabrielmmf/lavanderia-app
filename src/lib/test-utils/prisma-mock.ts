import { vi } from "vitest"

/**
 * Mock do Prisma Client usado pelos testes de unidade.
 *
 * Uso, no topo do arquivo de teste (hoisted pelo Vitest):
 *
 * ```ts
 * vi.mock("./prisma", () => ({ prisma: prismaMock }))
 * ```
 */
export const prismaMock = {
  booking: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  pushSubscription: {
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}

/** Zera todos os mocks e devolve retornos neutros. */
export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      fn.mockReset()
    }
  }
  prismaMock.booking.findMany.mockResolvedValue([])
  prismaMock.booking.findFirst.mockResolvedValue(null)
  prismaMock.booking.count.mockResolvedValue(0)
  prismaMock.booking.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.booking.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.pushSubscription.findMany.mockResolvedValue([])
  prismaMock.pushSubscription.count.mockResolvedValue(0)
  prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 0 })
}
