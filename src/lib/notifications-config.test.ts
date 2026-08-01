import { describe, expect, it } from "vitest"
import {
  endNotificationBody,
  normalizeVapidPublicKey,
  startNotificationBody,
  VAPID_PUBLIC_KEY_LENGTH,
} from "./notifications-config"

/** Chave de fachada com o formato real: 87 caracteres base64url. */
const CHAVE_VALIDA = "BPTqZN88yMEP4Femto_G0OwYKXVn9whAZYlfVDi4IVB0sTSbmvJKA2rTKA0PCzpnwU5jAAmjkLgX3CeYdG0tdac"

describe("normalizeVapidPublicKey", () => {
  it("aceita uma chave base64url de 87 caracteres", () => {
    expect(CHAVE_VALIDA).toHaveLength(VAPID_PUBLIC_KEY_LENGTH)
    expect(normalizeVapidPublicKey(CHAVE_VALIDA)).toBe(CHAVE_VALIDA)
  })

  it("remove espaços e quebras de linha coladas junto do valor", () => {
    expect(normalizeVapidPublicKey(`  ${CHAVE_VALIDA}\n`)).toBe(CHAVE_VALIDA)
  })

  it("remove o padding, que urlBase64ToUint8Array recalcula sozinho", () => {
    expect(normalizeVapidPublicKey(`${CHAVE_VALIDA}=`)).toBe(CHAVE_VALIDA)
  })

  it("rejeita ausência de valor", () => {
    expect(normalizeVapidPublicKey(undefined)).toBeNull()
    expect(normalizeVapidPublicKey(null)).toBeNull()
    expect(normalizeVapidPublicKey("")).toBeNull()
    expect(normalizeVapidPublicKey("   ")).toBeNull()
  })

  // Regressão: era exatamente este valor que estava na Vercel de produção. Por
  // ser uma string não vazia, passava pela checagem antiga (`!publicVapidKey`)
  // e só explodia dentro de `atob`, virando um "tente novamente" eterno.
  it("rejeita um placeholder não vazio", () => {
    expect(normalizeVapidPublicKey("[SENSITIVE]")).toBeNull()
    expect(normalizeVapidPublicKey("ci-placeholder-public-key")).toBeNull()
    expect(normalizeVapidPublicKey("your-vapid-public-key-here")).toBeNull()
  })

  it("rejeita chave com o tamanho errado", () => {
    expect(normalizeVapidPublicKey(CHAVE_VALIDA.slice(0, 86))).toBeNull()
    expect(normalizeVapidPublicKey(`${CHAVE_VALIDA}A`)).toBeNull()
  })

  it("rejeita caracteres fora do alfabeto base64url", () => {
    // Mesmo tamanho, mas com "+" e "/" (base64 comum) e um caractere solto.
    expect(normalizeVapidPublicKey(`+${CHAVE_VALIDA.slice(1)}`)).toBeNull()
    expect(normalizeVapidPublicKey(`${CHAVE_VALIDA.slice(0, 86)}/`)).toBeNull()
    expect(normalizeVapidPublicKey(`${CHAVE_VALIDA.slice(0, 86)}!`)).toBeNull()
  })
})

describe("corpo das notificações", () => {
  it("conta os minutos que faltam, sem repetir a antecedência configurada", () => {
    expect(startNotificationBody(2, 15)).toBe("Sua reserva na máquina 2 começa em 15 minutos.")
    expect(endNotificationBody(3, 12)).toContain("termina em 12 minutos")
  })

  it("concorda em número no singular", () => {
    expect(startNotificationBody(1, 1)).toContain("em 1 minuto.")
    expect(endNotificationBody(1, 1)).toContain("em 1 minuto.")
  })

  // Um aviso atrasado precisa dizer a verdade: "começa em 15 minutos" para um
  // horário que já começou é pior que não avisar.
  it("muda o texto quando o momento já passou", () => {
    expect(startNotificationBody(2, 0)).toBe("Sua reserva na máquina 2 já começou.")
    expect(startNotificationBody(2, -30)).toContain("já começou")
    expect(endNotificationBody(2, -5)).toContain("terminou")
  })
})
