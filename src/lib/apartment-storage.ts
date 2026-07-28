"use client"

import { useSyncExternalStore } from "react"

const KEY = "lavanderia-apartment"

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function getStoredApartment(): string {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    // localStorage pode lançar em modo privado / storage bloqueado.
    return ""
  }
}

export function setStoredApartment(value: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // Ignora falha de persistência; o valor ainda vale para a sessão atual.
  }
  emit()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

/**
 * Lê o apartamento persistido como um external store.
 *
 * Usar `useSyncExternalStore` (em vez de `useState` + `useEffect`) evita o
 * render em cascata que a regra `react-hooks/set-state-in-effect` proíbe e
 * mantém o valor consistente entre abas.
 */
export function useStoredApartment(): [string, (value: string) => void] {
  const apartment = useSyncExternalStore(
    subscribe,
    getStoredApartment,
    () => "" // snapshot do servidor: nada persistido durante o SSR
  )
  return [apartment, setStoredApartment]
}
