const CACHE_NAME = 'memorabilius-v6'

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

// Fetch : réseau d'abord sur les navigations de page (coquille HTML uniquement).
// Toujours la version fraîche quand il y a du réseau — le cache ne sert que de
// secours hors-ligne. (Le stale-while-revalidate testé précédemment affichait
// l'ancienne version en premier, ce qui donnait l'impression que le site ne se
// mettait pas à jour sans F5 — problématique vu la fréquence des déploiements.)
// Les données (Supabase, /api/*) ne passent jamais par ici : toujours en direct.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(event.request)
        if (res.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(event.request, res.clone())
        }
        return res
      } catch {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(event.request)
        return cached || caches.match('/offline.html')
      }
    })()
  )
})
