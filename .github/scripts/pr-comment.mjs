#!/usr/bin/env node
/**
 * Publica (ou atualiza) um comentário "fixo" no pull request.
 *
 * Cada MARKER tem no máximo um comentário: em vez de encher o pull request de
 * mensagens a cada push, a mesma mensagem é editada.
 *
 * Variáveis de ambiente: GH_TOKEN, REPO, PR_NUMBER, MARKER, BODY
 */
import { execFileSync } from "node:child_process"

const { REPO, PR_NUMBER, MARKER, BODY } = process.env

if (!REPO || !PR_NUMBER || !MARKER || !BODY) {
  console.error("Faltam variáveis: REPO, PR_NUMBER, MARKER, BODY são obrigatórias.")
  process.exit(1)
}

const marker = `<!-- lavanderia-bot:${MARKER} -->`
const body = `${marker}\n${BODY}`

function gh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
  })
}

const comments = JSON.parse(
  gh(["api", `repos/${REPO}/issues/${PR_NUMBER}/comments`, "--paginate"])
)
const existing = comments.find((comment) => comment.body?.includes(marker))

if (existing) {
  gh(["api", "--method", "PATCH", `repos/${REPO}/issues/comments/${existing.id}`, "-F", "body=@-"], body)
  console.log(`Comentário ${MARKER} atualizado.`)
} else {
  gh(["api", "--method", "POST", `repos/${REPO}/issues/${PR_NUMBER}/comments`, "-F", "body=@-"], body)
  console.log(`Comentário ${MARKER} criado.`)
}
