import { describe, expect, it } from "vitest"
import { errorMessage, errorName, errorResponse } from "./api-errors"

describe("errorMessage", () => {
  it("extrai a mensagem de um Error", () => {
    expect(errorMessage(new Error("falhou"))).toBe("falhou")
  })

  it("aceita string crua", () => {
    expect(errorMessage("falhou")).toBe("falhou")
  })

  it("usa um fallback para valores desconhecidos", () => {
    expect(errorMessage({ qualquer: "coisa" })).toBe("Erro inesperado")
    expect(errorMessage(null)).toBe("Erro inesperado")
  })
})

describe("errorName", () => {
  it("devolve o name de erros customizados", () => {
    class CustomError extends Error {
      name = "CustomError"
    }
    expect(errorName(new CustomError())).toBe("CustomError")
  })

  it("devolve undefined para não-erros", () => {
    expect(errorName("x")).toBeUndefined()
  })
})

describe("errorResponse", () => {
  it("monta o corpo e o status", async () => {
    const response = errorResponse(new Error("falhou"), 400)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "falhou", code: "Error" })
  })
})
