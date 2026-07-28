#!/usr/bin/env node
/**
 * Verifica que um deploy está realmente servindo a aplicação.
 *
 * Uso: node smoke-test.mjs <url-base>
 *
 * Um deploy "Ready" na Vercel só diz que o build terminou. Estes checks provam
 * que a página carrega e que a API conversa com o banco daquele ambiente —
 * é o que impede uma migration esquecida de passar despercebida.
 *
 * Deployments de preview ficam atrás do Deployment Protection da Vercel e
 * respondem com redirect para o SSO. Defina VERCEL_AUTOMATION_BYPASS_SECRET
 * (Vercel → Settings → Deployment Protection → Protection Bypass for
 * Automation) para que o smoke test consiga entrar.
 */

const baseUrl = process.argv[2]?.trim().replace(/\/$/, "")
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!baseUrl) {
  console.error("Uso: smoke-test.mjs <url-base>")
  process.exit(1)
}

const CHECKS = [
  { path: "/", description: "página inicial" },
  { path: "/api/bookings", description: "API de agendamentos (lê o banco)" },
]

const ATTEMPTS = 5
const BACKOFF_MS = 3000

const headers = {
  "user-agent": "lavanderia-smoke-test",
  ...(bypassSecret
    ? {
        "x-vercel-protection-bypass": bypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {}),
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Redirect para o SSO da Vercel significa proteção de deploy, não app quebrado. */
function isProtectionRedirect(response) {
  if (response.status !== 401 && (response.status < 300 || response.status >= 400)) {
    return false
  }
  const location = response.headers.get("location") ?? ""
  return response.status === 401 || location.includes("vercel.com/sso")
}

async function check({ path, description }) {
  const url = `${baseUrl}${path}`
  let lastError = "sem resposta"

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        // `manual` para enxergar o redirect do SSO em vez de seguir até a tela
        // de login e receber um 200 enganoso.
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      })

      if (response.ok) {
        console.log(`✓ ${description} — ${response.status} ${url}`)
        return true
      }

      if (isProtectionRedirect(response)) {
        console.error(
          `✗ ${description} — bloqueado pelo Deployment Protection da Vercel.\n` +
            "  Configure o secret VERCEL_AUTOMATION_BYPASS_SECRET no repositório\n" +
            "  (Vercel → Settings → Deployment Protection → Protection Bypass for Automation)."
        )
        return false // não adianta repetir: é configuração, não instabilidade
      }

      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error.message
    }

    if (attempt < ATTEMPTS) {
      console.log(`… ${description}: ${lastError} (tentativa ${attempt}/${ATTEMPTS})`)
      await sleep(BACKOFF_MS * attempt)
    }
  }

  console.error(`✗ ${description} — ${lastError} em ${url}`)
  return false
}

const results = []
for (const item of CHECKS) {
  results.push(await check(item))
}

if (results.some((ok) => !ok)) {
  console.error(`\nSmoke test falhou para ${baseUrl}`)
  process.exit(1)
}

console.log(`\nSmoke test OK para ${baseUrl}`)
