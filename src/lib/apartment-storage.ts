const KEY = "lavanderia-apartment"

export function getStoredApartment(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(KEY) ?? ""
}

export function setStoredApartment(value: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, value)
}
