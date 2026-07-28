/**
 * Identifica o compute endpoint do Neon a partir da connection string.
 *
 * Cada branch do Neon tem seu próprio endpoint (`ep-...`), então esse
 * identificador diz **qual branch do banco** a aplicação está usando de fato —
 * é o que permite ao CI provar que um deploy de preview fala com a branch do
 * pull request e não com produção.
 *
 * Devolve só o identificador, nunca host completo, usuário ou senha.
 */
export function databaseEndpointId(connectionString: string | undefined): string | null {
  if (!connectionString) return null

  try {
    const { hostname } = new URL(connectionString)
    const endpoint = hostname.split(".")[0]
    if (!endpoint) return null

    // O host com pooler é `<endpoint>-pooler`; normalizamos para que a mesma
    // branch produza o mesmo identificador com ou sem pooling.
    return endpoint.replace(/-pooler$/, "")
  } catch {
    return null
  }
}
