/**
 * Antecedência (em minutos) com que avisamos o usuário antes do início e do
 * término da reserva. Compartilhado entre o job de cron e a UI para que a
 * mensagem exibida e o comportamento real nunca divirjam.
 */
export const NOTIFICATION_LEAD_MINUTES = 15
