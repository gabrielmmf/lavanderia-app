---
"lavanderia-app": minor
---

Conserta as notificações push, que não chegavam, e passa a consolidar o
agendamento 1 hora **depois** do início.

Eram três problemas somados:

- **O ciclo abortava calado.** Sem chaves VAPID válidas o ciclo devolvia
  `sent: 0`, idêntico a uma execução sem nada para enviar, e o cron ficava
  verde com as notificações desligadas. Agora o resultado carrega
  `vapidConfigured` e o endpoint responde 503 nesse estado.
- **A janela perdia o aviso para sempre.** A busca ia de `now` até
  `now + 15min`; se nenhum ciclo caísse nesse intervalo, o agendamento saía da
  janela com o flag ainda `false` e nunca mais era notificado. A busca passa a
  começar em `now - NOTIFICATION_GRACE_MINUTES`, e o texto é calculado no
  envio: um aviso atrasado diz "já começou" em vez de mentir "começa em 15
  minutos".
- **Os avisos se substituíam em silêncio.** A `tag` do service worker era fixa,
  então o aviso de término substituía o de início sem som nem vibração. Agora
  cada aviso tem tag própria por agendamento e por tipo.

Na regra de consolidação, um agendamento agora só fica travado 1 hora depois do
início — dá tempo de desistir de um horário que não vai ser usado, inclusive
atrasando alguns minutos. Um agendamento que já terminou continua travado,
mesmo que tenha durado menos que isso, para que ninguém use a máquina e apague
o registro para escapar do limite semanal.
