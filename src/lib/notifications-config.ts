/**
 * Liga o ciclo de notificações por completo — envio, inscrição e a própria UI.
 *
 * Desligado por padrão, e isso é deliberado: enquanto está `false`, nenhum
 * caminho de notificação toca o banco. Essa é a razão de ele existir.
 *
 * O plano free do Neon dá 100 CU-horas por projeto por mês e mantém o
 * autosuspend fixo em 5 minutos, que não é configurável. O agendador chamava
 * `/api/cron/notifications` a cada 5 minutos e o ciclo consultava o banco em
 * toda chamada — ou seja, o compute era acordado exatamente no ritmo em que
 * tentaria dormir. Resultado: 0,25 CU ligado 24 horas por dia, ~5,9 CU-horas
 * por dia, e a cota do mês queimada no dia 19 de agosto de 2026, com o banco
 * suspenso e o app fora do ar (erro `53000`).
 *
 * Com a flag desligada o banco só acorda quando um morador de fato abre o app.
 *
 * Para religar: defina `NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true` no ambiente,
 * faça um novo deploy (o valor é embutido no bundle em build time), descomente
 * o `schedule` de `.github/workflows/cron-notifications.yml` e recrie o job no
 * cron-job.org. Antes disso, confira em `docs/DEPLOY.md` quanto de cota o
 * intervalo escolhido consome — 5 minutos não cabe no plano free.
 */
export const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED === "true"

/**
 * Antecedência (em minutos) com que avisamos o usuário antes do início e do
 * término da reserva. Compartilhado entre o job de cron e a UI para que a
 * mensagem exibida e o comportamento real nunca divirjam.
 */
export const NOTIFICATION_LEAD_MINUTES = 15

/**
 * Por quantos minutos além do momento previsto ainda vale a pena enviar o
 * aviso atrasado.
 *
 * Existe porque o agendador não é pontual: o `schedule` do GitHub Actions
 * chega a espaçar as execuções em horas, e o ciclo precisa continuar
 * entregando o que ficou para trás em vez de deixar o agendamento vazar da
 * janela sem nunca ter sido notificado. Passado esse prazo o aviso vira ruído
 * — o agendamento é marcado como tratado sem envio.
 */
export const NOTIFICATION_GRACE_MINUTES = 60

/**
 * Texto do corpo da notificação de início, conforme os minutos que realmente
 * faltam no momento do envio.
 *
 * A mensagem é calculada, e não fixa em `NOTIFICATION_LEAD_MINUTES`, porque um
 * aviso atrasado dizendo "começa em 15 minutos" quando o horário já começou
 * seria pior que não avisar.
 */
export function startNotificationBody(machineNumber: number, minutesUntil: number): string {
  const quando =
    minutesUntil <= 0
      ? "já começou"
      : `começa em ${minutesUntil} ${minutesUntil === 1 ? "minuto" : "minutos"}`
  return `Sua reserva na máquina ${machineNumber} ${quando}.`
}

/** Equivalente de `startNotificationBody` para o aviso de término. */
export function endNotificationBody(machineNumber: number, minutesUntil: number): string {
  if (minutesUntil <= 0) {
    return `Sua reserva na máquina ${machineNumber} terminou. Retire as roupas para liberar a máquina.`
  }
  const plural = minutesUntil === 1 ? "minuto" : "minutos"
  return `Sua reserva na máquina ${machineNumber} termina em ${minutesUntil} ${plural}. Prepare-se para retirar as roupas.`
}

/**
 * Comprimento de uma chave VAPID pública em base64url.
 *
 * A chave é um ponto da curva P-256 sem compressão: 65 bytes, que em base64url
 * sem padding dão exatamente 87 caracteres.
 */
export const VAPID_PUBLIC_KEY_LENGTH = 87

/**
 * Normaliza a chave VAPID pública vinda do ambiente, devolvendo `null` quando o
 * valor não serve como chave.
 *
 * Existe porque "a variável está preenchida" não é o mesmo que "a chave é
 * válida": um placeholder qualquer passa por um simples teste de string vazia,
 * chega intacto até `pushManager.subscribe` e só então estoura dentro do
 * `atob` — o que a UI não tem como distinguir de uma falha de rede, e vira um
 * "tente novamente" que nunca vai funcionar. Melhor reprovar aqui, cedo e com
 * uma mensagem que aponta para a configuração.
 *
 * Sem dependências de propósito: é usada tanto pelo client quanto pelo servidor.
 */
export function normalizeVapidPublicKey(raw: string | null | undefined): string | null {
  // O padding é removido porque `urlBase64ToUint8Array` recalcula o dele.
  const key = (raw ?? "").trim().replace(/=+$/, "")

  if (key.length !== VAPID_PUBLIC_KEY_LENGTH) return null
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null

  return key
}
