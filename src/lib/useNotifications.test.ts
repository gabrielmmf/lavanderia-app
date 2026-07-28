import { afterEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useNotifications } from "./useNotifications"

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
    value: { permission: "default", requestPermission: vi.fn() },
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

  afterEach(() => {
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
})
