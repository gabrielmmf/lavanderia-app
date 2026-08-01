/* Service worker do Web Push da lavanderia. */

// Assume o controle assim que instalado, para que uma nova versão do worker
// passe a valer sem exigir que o usuário feche todas as abas.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "Lavanderia", body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Lavanderia", {
      body: data.body ?? "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      vibrate: [100, 50, 100],
      // Só um reenvio do MESMO aviso substitui o anterior — daí a tag vir do
      // servidor, única por agendamento e por tipo. Com uma tag fixa, o aviso
      // de término substituiria silenciosamente o de início.
      tag: data.tag ?? "lavanderia",
      // `renotify` exige `tag`; como sempre há uma, alertar de novo é seguro.
      renotify: true,
      data: { url: data.url ?? "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Reaproveita uma aba já aberta do app em vez de abrir outra.
        const existing = windowClients.find((client) =>
          client.url.startsWith(self.location.origin)
        )
        if (existing) return existing.focus()
        return self.clients.openWindow(targetUrl)
      })
  )
})
