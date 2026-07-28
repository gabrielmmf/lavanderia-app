#!/usr/bin/env node
/**
 * Remove deployments de PREVIEW antigos da Vercel.
 *
 * Regras de segurança, todas obrigatórias — um deployment só é removido se
 * passar em TODAS:
 *   1. não é de produção (produção é histórico de rollback, nunca se apaga);
 *   2. é mais antigo que RETENTION_DAYS;
 *   3. não tem alias ativo apontando para ele;
 *   4. não está entre os KEEP_RECENT previews mais recentes.
 *
 * Por padrão roda em modo simulação. Só apaga de verdade com APPLY=true.
 *
 * Variáveis: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID,
 *            RETENTION_DAYS (padrão 14), KEEP_RECENT (padrão 5), APPLY
 */

const token = process.env.VERCEL_TOKEN
const projectId = process.env.VERCEL_PROJECT_ID
const teamId = process.env.VERCEL_ORG_ID
const retentionDays = Number(process.env.RETENTION_DAYS ?? 14)
const keepRecent = Number(process.env.KEEP_RECENT ?? 5)
const apply = process.env.APPLY === "true"

if (!token || !projectId) {
  console.error("VERCEL_TOKEN e VERCEL_PROJECT_ID são obrigatórios.")
  process.exit(1)
}
if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  console.error("RETENTION_DAYS precisa ser um número >= 1.")
  process.exit(1)
}

const api = (path) => {
  const url = new URL(path, "https://api.vercel.com")
  if (teamId) url.searchParams.set("teamId", teamId)
  return url
}

async function call(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url.pathname} → ${response.status} ${await response.text()}`)
  }
  return response.json()
}

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000

const url = api("/v6/deployments")
url.searchParams.set("projectId", projectId)
url.searchParams.set("limit", "100")

const { deployments = [] } = await call(url)

const previews = deployments
  .filter((d) => d.target !== "production")
  .sort((a, b) => b.created - a.created)

const production = deployments.filter((d) => d.target === "production")

console.log(`Deployments encontrados: ${deployments.length}`)
console.log(`  produção (preservados sempre): ${production.length}`)
console.log(`  preview: ${previews.length}`)
console.log(`Retenção: ${retentionDays} dias | manter os ${keepRecent} previews mais recentes`)
console.log(apply ? "MODO: APAGANDO\n" : "MODO: SIMULAÇÃO (defina APPLY=true para apagar)\n")

const candidates = previews.slice(keepRecent).filter((d) => {
  if (d.created >= cutoff) return false
  // `aliasAssigned` indica alias ativo; nunca removemos algo que alguém acessa.
  if (d.aliasAssigned) return false
  return true
})

if (candidates.length === 0) {
  console.log("Nada a remover.")
  process.exit(0)
}

let removed = 0
for (const deployment of candidates) {
  const age = Math.round((Date.now() - deployment.created) / 86_400_000)
  const label = `${deployment.uid} (${deployment.url}, ${age} dias)`

  if (!apply) {
    console.log(`  [simulação] removeria ${label}`)
    continue
  }

  try {
    await call(api(`/v13/deployments/${deployment.uid}`), { method: "DELETE" })
    console.log(`  removido ${label}`)
    removed++
  } catch (error) {
    // Falhar a limpeza inteira por causa de um deployment não compensa.
    console.warn(`  falhou ao remover ${label}: ${error.message}`)
  }
}

console.log(
  apply
    ? `\n${removed} de ${candidates.length} deployments removidos.`
    : `\n${candidates.length} deployments seriam removidos.`
)
