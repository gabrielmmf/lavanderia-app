---
"lavanderia-app": patch
---

Corrige o botão "Ativar notificações", que nunca aparecia em um navegador sem
service worker previamente registrado (primeiro acesso, aba anônima, deploy
novo). O botão dependia de um service worker que só era registrado ao
clicá-lo — um ciclo que nunca se completava sozinho.
