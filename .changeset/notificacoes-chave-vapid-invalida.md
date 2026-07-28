---
"lavanderia-app": patch
---

Corrige as notificações, que não podiam ser ativadas em produção: o botão
continuava em "Ativar notificações" e cada clique respondia "Não foi possível
ativar as notificações. Tente novamente". A chave VAPID pública do deploy estava
com um valor inválido, e o app só percebia isso no meio da inscrição, tarde
demais para dizer o que estava errado.

Agora a chave é validada antes de qualquer tentativa: quando ela está ausente ou
malformada, o botão aparece como "Indisponíveis" em vez de prometer algo que
falharia, e o convite para ativar as notificações não é mais exibido. O
`/api/health` passou a informar se o Web Push está configurado, e o smoke test
do release avisa quando um deploy sobe sem notificações.
