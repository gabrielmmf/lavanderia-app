import { NextResponse } from "next/server"

/** Extrai uma mensagem legível de um `unknown` capturado num catch. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Erro inesperado"
}

/** Extrai o `name` de um erro, usado como código na resposta da API. */
export function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined
}

/** Resposta JSON de erro padronizada para as rotas de API. */
export function errorResponse(error: unknown, status: number) {
  return NextResponse.json(
    { error: errorMessage(error), code: errorName(error) },
    { status }
  )
}
