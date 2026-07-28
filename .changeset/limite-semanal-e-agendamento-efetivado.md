---
"lavanderia-app": minor
---

Novo limite de 4 agendamentos por apartamento a cada 7 dias, para coibir o uso
diário abusivo das máquinas. Agendamentos que já começaram, estão a menos de
1 hora do início, ou já terminaram são considerados "efetivados" e não podem
mais ser apagados pelo morador — isso fecha a brecha de apagar um agendamento
em uso só para marcar outro em seguida. As duas regras novas estão explicadas
no diálogo "Como funciona a Lavanderia".

Também alinha a limpeza automática de agendamentos antigos com a janela do
novo limite semanal (de 24 horas para 7 dias após o término), para que o
limite consiga enxergar o uso passado.
