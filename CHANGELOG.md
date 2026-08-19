# lavanderia-app

## 0.4.0

### Minor Changes

- [#18](https://github.com/gabrielmmf/lavanderia-app/pull/18) [`8e8d64a`](https://github.com/gabrielmmf/lavanderia-app/commit/8e8d64abde4be07ebd19c6a41964362bdd5072df) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Desliga as notificações push para o app parar de derrubar o banco.

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

## 0.3.0

### Minor Changes

- [#15](https://github.com/gabrielmmf/lavanderia-app/pull/15) [`0a636d0`](https://github.com/gabrielmmf/lavanderia-app/commit/0a636d0fed860785fffe5bf10f913768c7504c05) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Conserta as notificações push, que não chegavam, e passa a consolidar o
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

## 0.2.1

### Patch Changes

- [#11](https://github.com/gabrielmmf/lavanderia-app/pull/11) [`75004ad`](https://github.com/gabrielmmf/lavanderia-app/commit/75004ad49c0565e987cf250a82ecb2336f02d140) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Corrige as notificações, que não podiam ser ativadas em produção: o botão
  continuava em "Ativar notificações" e cada clique respondia "Não foi possível
  ativar as notificações. Tente novamente". A chave VAPID pública do deploy estava
  com um valor inválido, e o app só percebia isso no meio da inscrição, tarde
  demais para dizer o que estava errado.

  Agora a chave é validada antes de qualquer tentativa: quando ela está ausente ou
  malformada, o botão aparece como "Indisponíveis" em vez de prometer algo que
  falharia, e o convite para ativar as notificações não é mais exibido. O
  `/api/health` passou a informar se o Web Push está configurado, e o smoke test
  do release avisa quando um deploy sobe sem notificações.

## 0.2.0

### Minor Changes

- [#2](https://github.com/gabrielmmf/lavanderia-app/pull/2) [`d97976c`](https://github.com/gabrielmmf/lavanderia-app/commit/d97976c305a93f5f67e4e1d7e98ba36b1d4b3364) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Novo limite de 4 agendamentos por apartamento a cada 7 dias, para coibir o uso
  diário abusivo das máquinas. Agendamentos que já começaram, estão a menos de
  1 hora do início, ou já terminaram são considerados "efetivados" e não podem
  mais ser apagados pelo morador — isso fecha a brecha de apagar um agendamento
  em uso só para marcar outro em seguida. As duas regras novas estão explicadas
  no diálogo "Como funciona a Lavanderia".

  Também alinha a limpeza automática de agendamentos antigos com a janela do
  novo limite semanal (de 24 horas para 7 dias após o término), para que o
  limite consiga enxergar o uso passado.

- [#2](https://github.com/gabrielmmf/lavanderia-app/pull/2) [`519eb30`](https://github.com/gabrielmmf/lavanderia-app/commit/519eb304ef571f1bf0b367249825d3a850d7706e) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Notificações push avisam o morador 15 minutos antes do início e do término da
  reserva, e o formulário passa a pedir a duração da reserva em vez do horário de
  término.

  Também corrige o modelo de dados das notificações, que estava incompleto e
  impedia o app de compilar, e passa a exigir autenticação no endpoint de cron.

### Patch Changes

- [#2](https://github.com/gabrielmmf/lavanderia-app/pull/2) [`25cd4d6`](https://github.com/gabrielmmf/lavanderia-app/commit/25cd4d6267d1e5c850c8f15cf98726dd0ea6f051) Thanks [@gabrielmmf](https://github.com/gabrielmmf)! - Corrige o botão "Ativar notificações", que nunca aparecia em um navegador sem
  service worker previamente registrado (primeiro acesso, aba anônima, deploy
  novo). O botão dependia de um service worker que só era registrado ao
  clicá-lo — um ciclo que nunca se completava sozinho.
