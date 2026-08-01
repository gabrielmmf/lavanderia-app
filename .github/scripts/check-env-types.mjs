#!/usr/bin/env node
/**
 * Reprova o deploy se alguma variável de ambiente do projeto estiver marcada
 * como `sensitive` na Vercel.
 *
 * Uso: node check-env-types.mjs <preview|production>
 *
 * Uma variável `sensitive` não pode ser lida de volta — nem pela API, nem
 * pelo CLI. O deploy deste projeto é construído no runner (`vercel pull` →
 * `vercel build` → `vercel deploy --prebuilt`), então o `pull` grava a string
 * literal "[SENSITIVE]" no env local para essas variáveis, e o `build` assa
 * esse texto no bundle no lugar do valor real — sem erro, sem aviso. Foi
 * assim que `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ficou quebrada em produção por
 * dias: o build passava, o deploy subia, só o valor estava errado.
 *
 * Roda logo após `vercel pull`, antes do build, para falhar rápido e ainda
 * apontar a causa — em vez de deixar o smoke test descobrir só no final.
 */
const environment = process.argv[2]

if (environment !== "preview" && environment !== "production") {
  console.error("Uso: check-env-types.mjs <preview|production>")
  process.exit(1)
}

const token = process.env.VERCEL_TOKEN
const teamId = process.env.VERCEL_ORG_ID
const projectId = process.env.VERCEL_PROJECT_ID

if (!token || !teamId || !projectId) {
  console.error(
    "::error::VERCEL_TOKEN, VERCEL_ORG_ID ou VERCEL_PROJECT_ID ausente — não é possível checar o tipo das variáveis."
  )
  process.exit(1)
}

const response = await fetch(
  `https://api.vercel.com/v10/projects/${projectId}/env?decrypt=false&teamId=${teamId}`,
  { headers: { Authorization: `Bearer ${token}` } }
)

if (!response.ok) {
  console.error(`::error::Vercel API respondeu ${response.status} ao listar as variáveis do projeto.`)
  process.exit(1)
}

const { envs = [] } = await response.json()

const sensitive = envs.filter(
  (env) => env.type === "sensitive" && (env.target || []).includes(environment)
)

if (sensitive.length > 0) {
  const keys = sensitive.map((env) => env.key).join(", ")
  console.error(
    `::error::Variáveis marcadas como "sensitive" em ${environment}: ${keys}\n` +
      "  Essas variáveis não podem ser lidas de volta pelo CI, então o `vercel pull`\n" +
      '  grava "[SENSITIVE]" no lugar do valor real, e o build usa esse texto.\n' +
      "  Recrie-as como `encrypted`:\n" +
      `    vercel env rm <chave> ${environment}\n` +
      `    vercel env add <chave> ${environment}\n` +
      "  Detalhes em docs/DEPLOY.md, seção \"As chaves VAPID não podem ser sensitive na Vercel\"."
  )
  process.exit(1)
}

console.log(`✓ Nenhuma variável "sensitive" em ${environment} (${envs.length} variáveis conferidas).`)
