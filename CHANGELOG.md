# lavanderia-app

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
