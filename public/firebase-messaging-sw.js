/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js")

const params = new URL(self.location.href).searchParams
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
}
// optional ones, when the page passed them
for (const key of ["storageBucket", "measurementId"]) {
  if (params.get(key)) firebaseConfig[key] = params.get(key)
}

if (["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"].every((key) => Boolean(firebaseConfig[key]))) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return
    const title = payload.notification?.title || payload.data?.title || "New notification"
    const body = payload.notification?.body || payload.data?.body || ""
    const link = payload.fcmOptions?.link || payload.data?.link || "/"

    self.registration.showNotification(title, {
      body,
      data: {
        link,
      },
    })
  })
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const rawLink = event.notification.data?.link || "/"
  let link = "/"
  try { const url = new URL(rawLink, self.location.origin); if (url.origin === self.location.origin) link = `${url.pathname}${url.search}${url.hash}` } catch { link = "/" }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(link)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(link)
      }

      return undefined
    }),
  )
})
