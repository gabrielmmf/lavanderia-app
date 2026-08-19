import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Valores previsíveis para os testes que dependem de configuração.
// A chave pública é descartável, mas precisa ter o formato real (87 caracteres
// base64url): o app recusa chave malformada, e um valor de fachada qualquer
// deixaria os testes rodando com as notificações permanentemente desligadas.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??=
  "BPTqZN88yMEP4Femto_G0OwYKXVn9whAZYlfVDi4IVB0sTSbmvJKA2rTKA0PCzpnwU5jAAmjkLgX3CeYdG0tdac"
process.env.VAPID_PRIVATE_KEY ??= "test-private-vapid-key"
// Os testes exercitam o caminho LIGADO por padrão. Em produção a flag está
// desligada (ver NOTIFICATIONS_ENABLED), mas manter a suíte no caminho ligado é
// o que preserva a cobertura do ciclo de notificações inteiro para quando ele
// voltar. Os testes do estado desligado ajustam a variável e reimportam.
process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED ??= "true"
process.env.CRON_SECRET ??= "test-cron-secret"
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
