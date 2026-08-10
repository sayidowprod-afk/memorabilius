const CACHE_NAME = 'memorabilius-v4'

// Seuls les assets vraiment statiques sont pré-cachés (pas les pages Next.js)
const STATIC_ASSETS = ['/offline.html', '/icon-192.png', '/icon-512.png', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Memorabilius', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) {
        const client = list[0]
        client.focus()
        if ('navigate' in client) return client.navigate(url)
        return
      }
      return clients.openWindow(url)
    })
  )
})

// Fetch : uniquement fallback offline pour les navigations de page
// On ne met RIEN en cache dynamiquement pour éviter les pages obsolètes après déploiement
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/offline.html'))
  )
})
