---
"lavanderia-app": minor
---

Notificações push avisam o morador 15 minutos antes do início e do término da
reserva, e o formulário passa a pedir a duração da reserva em vez do horário de
término.

Também corrige o modelo de dados das notificações, que estava incompleto e
impedia o app de compilar, e passa a exigir autenticação no endpoint de cron.
