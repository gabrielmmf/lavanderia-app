import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Valores previsíveis para os testes que dependem de configuração.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??= "test-public-vapid-key"
process.env.VAPID_PRIVATE_KEY ??= "test-private-vapid-key"
process.env.CRON_SECRET ??= "test-cron-secret"
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
