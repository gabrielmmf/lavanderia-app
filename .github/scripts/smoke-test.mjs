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
 * Deployments de preview ficam atrás do Deployment Protection da Vercel.
 * Defina VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Settings → Deployment
 * Protection → Protection Bypass for Automation) para que o CI consiga entrar.
 *
 * Redirects NÃO são seguidos automaticamente: sem proteção derrubada, a Vercel
 * redireciona para o próprio login, que responde 200 — seguir cegamente daria
 * um falso positivo.
 */

const baseUrl = process.argv[2]?.trim().replace(/\/$/, "")
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const healthSecret = process.env.CRON_SECRET
const expectedEndpoint = process.env.EXPECTED_DB_ENDPOINT?.trim()

if (!baseUrl) {
  console.error("Uso: smoke-test.mjs <url-base>")
  process.exit(1)
}

const CHECKS = [
  { path: "/", description: "página inicial" },
  { path: "/api/health", description: "health check (banco e schema)" },
  { path: "/api/bookings", description: "API de agendamentos (lê o banco)" },
]

const ATTEMPTS = 5
const BACKOFF_MS = 3000
const MAX_REDIRECTS = 3

const headers = {
  "user-agent": "lavanderia-smoke-test",
  // Só o header de bypass. NÃO pedimos `x-vercel-set-bypass-cookie`: ele faz a
  // Vercel responder 307 apenas para gravar o cookie, o que não serve de nada
  // numa checagem sem sessão e ainda mascara o resultado real.
  ...(bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {}),
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Qualquer redirect para o domínio da Vercel é a barreira de proteção. */
function isVercelHost(url) {
  return url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com")
}

/**
 * Faz a requisição resolvendo redirects manualmente, para distinguir
 * "o app redirecionou" de "a Vercel bloqueou".
 */
async function request(url, extraHeaders = {}) {
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      headers: { ...headers, ...extraHeaders },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    })

    if (response.status < 300 || response.status >= 400) {
      return { kind: "response", response, url: current }
    }

    const location = response.headers.get("location")
    if (!location) {
      return { kind: "response", response, url: current }
    }

    const target = new URL(location, current)
    if (isVercelHost(target)) {
      return { kind: "blocked", status: response.status, target: target.href }
    }

    current = target.href
  }

  return { kind: "too-many-redirects", url: current }
}

async function check({ path, description }) {
  const url = `${baseUrl}${path}`
  let lastError = "sem resposta"

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const result = await request(url)

      if (result.kind === "response" && result.response.ok) {
        console.log(`✓ ${description} — ${result.response.status} ${result.url}`)
        return true
      }

      if (result.kind === "blocked") {
        // Configuração, não instabilidade: repetir não muda nada.
        console.error(
          `✗ ${description} — bloqueado pelo Deployment Protection da Vercel ` +
            `(HTTP ${result.status} → ${result.target})\n` +
            (bypassSecret
              ? "  O secret VERCEL_AUTOMATION_BYPASS_SECRET foi enviado mas recusado.\n" +
                "  Confira se o valor bate com o gerado em Settings → Deployment Protection."
              : "  Configure o secret VERCEL_AUTOMATION_BYPASS_SECRET no repositório\n" +
                "  (Vercel → Settings → Deployment Protection → Protection Bypass for Automation).")
        )
        return false
      }

      lastError =
        result.kind === "too-many-redirects"
          ? `redirects demais (>${MAX_REDIRECTS})`
          : `HTTP ${result.response.status}`
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

/**
 * Confirma que o deploy está falando com o banco que esperamos.
 *
 * Este é o check que impede o cenário mais perigoso do projeto: um preview
 * apontando para o banco de PRODUÇÃO. Sem ele, tudo responde 200 e o problema
 * só aparece quando alguém corrompe dados reais.
 */
async function checkDatabaseIdentity() {
  if (!expectedEndpoint) {
    console.log("… identidade do banco: não verificada (EXPECTED_DB_ENDPOINT ausente)")
    return true
  }
  if (!healthSecret) {
    console.error("✗ identidade do banco: CRON_SECRET ausente, impossível verificar")
    return false
  }

  const result = await request(`${baseUrl}/api/health`, {
    authorization: `Bearer ${healthSecret}`,
  })

  if (result.kind !== "response") {
    console.error(`✗ identidade do banco: /api/health inacessível (${result.kind})`)
    return false
  }

  const body = await result.response.json().catch(() => null)
  const actual = body?.database?.endpoint

  if (!actual) {
    console.error(
      "✗ identidade do banco: /api/health não devolveu o endpoint.\n" +
        "  O CRON_SECRET do CI provavelmente difere do configurado na Vercel."
    )
    return false
  }

  if (actual !== expectedEndpoint) {
    console.error(
      `✗ IDENTIDADE DO BANCO ERRADA\n` +
        `    esperado: ${expectedEndpoint}\n` +
        `    obtido  : ${actual}\n` +
        `  Este deploy está conectado à branch errada do Neon.`
    )
    return false
  }

  console.log(`✓ identidade do banco — conectado a ${actual}`)

  if (body?.database?.schemaUpToDate !== true) {
    console.error("✗ schema desatualizado nesse banco: faltam migrations")
    return false
  }

  return true
}

console.log(
  `Smoke test em ${baseUrl}\n` +
    `  bypass de proteção: ${bypassSecret ? "configurado" : "ausente"}\n` +
    `  banco esperado    : ${expectedEndpoint || "(não verificado)"}`
)

const results = []
for (const item of CHECKS) {
  results.push(await check(item))
}
results.push(await checkDatabaseIdentity())

if (results.some((ok) => !ok)) {
  console.error(`\nSmoke test falhou para ${baseUrl}`)
  process.exit(1)
}

console.log(`\nSmoke test OK para ${baseUrl}`)
