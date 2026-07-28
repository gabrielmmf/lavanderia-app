import { afterEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useNotifications } from "./useNotifications"

/** Chave de fachada com o formato real: 87 caracteres base64url. */
const CHAVE_PUBLICA_VALIDA =
  "BPTqZN88yMEP4Femto_G0OwYKXVn9whAZYlfVDi4IVB0sTSbmvJKA2rTKA0PCzpnwU5jAAmjkLgX3CeYdG0tdac"

/**
 * A chave VAPID é lida uma única vez, no topo do módulo — como acontece no
 * bundle, onde o valor é inlinado em tempo de build. Para testar chaves
 * diferentes é preciso reimportar o hook com o ambiente já ajustado.
 */
async function importHook(publicKey: string | undefined) {
  vi.resetModules()
  if (publicKey === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = publicKey
  return (await import("./useNotifications")).useNotifications
}

/**
 * Simula um navegador que suporta Web Push mas nunca teve um service worker
 * registrado antes (primeiro acesso, aba anônima, deploy novo). `ready` de um
 * service worker nunca registrado não resolve nem rejeita — é assim que a
 * Web Push API se comporta de verdade, e é a causa raiz do bug: o hook usava
 * `ready` para decidir `isSupported`, mas o registro só acontecia ao clicar
 * no botão que `isSupported` controla.
 */
function mockPushCapableBrowser({ everRegistered }: { everRegistered: boolean }) {
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(),
    },
  }

  const register = vi.fn().mockResolvedValue(registration)
  const ready = everRegistered ? Promise.resolve(registration) : new Promise(() => {})

  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") },
  })
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  })
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, ready, getRegistration: vi.fn().mockResolvedValue(undefined) },
  })

  return { register, registration }
}

describe("useNotifications", () => {
  const originalNotification = window.Notification
  const originalPushManager = window.PushManager
  const originalServiceWorker = navigator.serviceWorker
  const originalVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalVapidKey
    vi.unstubAllGlobals()
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: originalNotification,
    })
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: originalPushManager,
    })
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalServiceWorker,
    })
  })

  it("detecta suporte a push mesmo sem service worker previamente registrado", async () => {
    mockPushCapableBrowser({ everRegistered: false })

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(result.current.isSupported).toBe(true))
  })

  it("continua detectando suporte quando já havia um service worker ativo", async () => {
    mockPushCapableBrowser({ everRegistered: true })

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(result.current.isSupported).toBe(true))
  })

  /**
   * Regressão do bug de produção: a Vercel estava com um placeholder no lugar
   * da chave VAPID pública. Por ser uma string não vazia, ela passava pela
   * checagem antiga (`!publicVapidKey`), chegava até `pushManager.subscribe` e
   * só então estourava dentro do `atob` — o morador via "Não foi possível
   * ativar as notificações. Tente novamente." em todo clique, e o botão nunca
   * saía de "Ativar notificações", porque nenhuma inscrição chegava a existir.
   */
  describe("com chave VAPID inválida", () => {
    it.each([
      ["um placeholder não vazio", "[SENSITIVE]"],
      ["um valor com o tamanho errado", "chave-curta-demais"],
      ["variável ausente", undefined],
    ])("reporta isConfigured falso com %s", async (_caso, chave) => {
      const useHook = await importHook(chave)
      mockPushCapableBrowser({ everRegistered: true })

      const { result } = renderHook(() => useHook())

      await waitFor(() => expect(result.current.isSupported).toBe(true))
      expect(result.current.isConfigured).toBe(false)
    })

    it("nem tenta se inscrever e explica que o problema é de configuração", async () => {
      const useHook = await importHook("[SENSITIVE]")
      const { registration } = mockPushCapableBrowser({ everRegistered: true })
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      const { result } = renderHook(() => useHook())
      await waitFor(() => expect(result.current.isSupported).toBe(true))

      await act(async () => {
        await result.current.requestPermission("101")
      })

      expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.current.error).toContain("chave VAPID")
      // O erro antigo convidava a repetir uma ação que jamais funcionaria.
      expect(result.current.error).not.toContain("Tente novamente")
    })
  })

  describe("com chave VAPID válida", () => {
    it("se inscreve, avisa o servidor e passa a reportar isSubscribed", async () => {
      const useHook = await importHook(CHAVE_PUBLICA_VALIDA)
      const { registration } = mockPushCapableBrowser({ everRegistered: true })
      const subscription = {
        endpoint: "https://push.example/abc",
        keys: { p256dh: "p", auth: "a" },
      }
      registration.pushManager.subscribe.mockResolvedValue(subscription)
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal("fetch", fetchMock)

      const { result } = renderHook(() => useHook())
      await waitFor(() => expect(result.current.isSupported).toBe(true))
      expect(result.current.isConfigured).toBe(true)

      await act(async () => {
        await result.current.requestPermission(" 101 ")
      })

      // 65 bytes: o ponto não comprimido da curva P-256 que o PushManager exige.
      const { applicationServerKey } = registration.pushManager.subscribe.mock.calls[0][0]
      expect(applicationServerKey).toBeInstanceOf(Uint8Array)
      expect(applicationServerKey).toHaveLength(65)

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/subscribe",
        expect.objectContaining({
          body: JSON.stringify({ subscription, apartmentNumber: "101" }),
        })
      )
      expect(result.current.error).toBeNull()
      expect(result.current.isSubscribed).toBe(true)
    })

    it("mostra erro transitório quando o servidor recusa a inscrição", async () => {
      const useHook = await importHook(CHAVE_PUBLICA_VALIDA)
      const { registration } = mockPushCapableBrowser({ everRegistered: true })
      registration.pushManager.subscribe.mockResolvedValue({ endpoint: "https://push/x" })
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
      vi.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => useHook())
      await waitFor(() => expect(result.current.isSupported).toBe(true))

      await act(async () => {
        await result.current.requestPermission("101")
      })

      // Aqui, sim, repetir faz sentido: a falha pode ser de rede.
      expect(result.current.error).toContain("Tente novamente")
      expect(result.current.isSubscribed).toBe(false)
    })
  })
})
