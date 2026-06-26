const CACHE_NAME = 'memorabilius-v1'
const STATIC_ASSETS = [
  '/',
  '/annuaire',
  '/trades',
  '/teams',
  '/manifest.json',
  '/favicon.ico',
]

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
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url && 'focus' in client) { client.focus(); return }
      }
      return clients.openWindow(event.notification.data?.url || '/')
    })
  )
})

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes API et Supabase
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase') ||
      event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
