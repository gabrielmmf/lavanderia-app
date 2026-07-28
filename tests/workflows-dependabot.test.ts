import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Pull requests do Dependabot rodam com o cofre "Dependabot secrets": os
// secrets do Actions chegam vazios. Sem estes guards, todo bump de dependência
// abre com `Banco + deploy de preview` e `Changeset` vermelhos —
// `Input required and not supplied: api_key` no primeiro passo do preview.
// Ver docs/DEPLOY.md.
const GUARD = "github.event.pull_request.user.login != 'dependabot[bot]'"

function lerWorkflow(caminho: string) {
  // Normaliza a quebra de linha do YAML dobrado (`>-`) para que o guard possa
  // ser escrito em várias linhas sem quebrar o teste.
  return readFileSync(caminho, "utf8").replace(/\s+/g, " ")
}

describe("workflows dispensam o Dependabot", () => {
  it.each([
    [".github/workflows/preview.yml", "não tenta criar branch no Neon"],
    [".github/workflows/preview-cleanup.yml", "não tenta apagar branch no Neon"],
    [".github/workflows/ci.yml", "não exige changeset"],
  ])("%s %s", (caminho) => {
    expect(lerWorkflow(caminho)).toContain(GUARD)
  })
})
