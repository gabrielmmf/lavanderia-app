---
"lavanderia-app": minor
---

Desliga as notificações push para o app parar de derrubar o banco.

Em 19/08/2026 o app saiu do ar com `Database error. Code: 53000 — Your account
or project has exceeded the compute time quota`. Não era bug de query nem de
deploy: era o próprio ciclo de notificações consumindo a cota de compute do
Neon.

O plano free dá 100 CU-horas por projeto por mês e mantém o autosuspend **fixo
em 5 minutos**. O agendador chamava `/api/cron/notifications` a cada 5 minutos e
o ciclo consultava o banco em toda chamada — ou seja, acordava o compute
exatamente no ritmo em que ele tentaria dormir. O banco ficava ligado 24 horas
por dia no piso de 0,25 CU: ~5,9 CU-horas por dia, 110,1 das 100 CU-horas
gastas até o dia 19, e o compute suspenso pelo resto do mês.

O desligamento vale para o caminho inteiro, e o critério em toda parte é **não
tocar no banco**, não apenas "não enviar":

- `runNotificationCycle` retorna antes da primeira consulta.
- `/api/cron/notifications` responde 200 com `enabled: false` — desligar de
  propósito não é falha, e gastar o 503 nisso ensinaria a ignorar o vermelho
  quando ele importasse de verdade.
- As rotas de inscrição e cancelamento respondem 503 antes de qualquer
  gravação: registrar uma inscrição que nunca será usada acordaria o compute
  por 5 minutos, que é justamente o custo a evitar.
- A UI mostra o botão como "Desativadas" em vez de sumir com ele. Os avisos vão
  parar de chegar de um jeito que o morador percebe; sem nada escrito na tela,
  ele conclui que o app quebrou.
- O `schedule` do `cron-notifications.yml` está comentado. Mesmo espaçado em
  horas pelo GitHub, ele sozinho manteria o banco acordado boa parte do dia.

`/api/health` passa a distinguir `notifications.enabled` (decidimos ligar?) de
`notifications.configured` (as chaves VAPID servem?) — um único booleano faria
um silêncio deliberado e uma chave quebrada ficarem idênticos de fora.

A cobertura do ciclo continua inteira: a suíte roda no caminho ligado, e os
testes novos cobrem o desligado. Como religar, e quanto de cota cada intervalo
de cron consome, está em `docs/DEPLOY.md`.
