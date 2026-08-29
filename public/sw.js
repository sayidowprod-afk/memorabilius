const CACHE_NAME = 'memorabilius-v7'

// Cache séparé pour les photos de cartes (Supabase Storage, ibb.co, etc.) —
// cache-first : une fois une carte vue, sa photo reste dispo hors-ligne même
// après redémarrage de l'app (le cache HTTP navigateur normal n'offre pas
// cette garantie, surtout dans une WebView qui purge plus agressivement).
// Volontairement séparé du cache HTML/statique ci-dessus, qui lui reste
// network-first (voir commentaire plus bas sur les risques de chunks JS
// périmés) — les photos n'ont pas ce risque, une image ne "casse" jamais.
const IMAGE_CACHE_NAME = 'memorabilius-images-v1'
const IMAGE_CACHE_MAX_ENTRIES = 500

// La coquille HTML seule ne sert a rien hors-ligne si ses scripts/styles ne
// se chargent pas -- avant ca, seule la NAVIGATION (le HTML) etait mise en
// cache (voir plus bas), jamais /_next/static/* : React ne pouvait donc
// jamais demarrer hors-ligne (page figee sur le rendu SSR initial, aucune
// des resiliences cote app -- cache localStorage, retry -- ne s'executait,
// puisqu'aucun JS ne tournait). Ces fichiers sont content-hashes par build
// (nom different a chaque changement), donc un cache-first sans expiration
// est correct : jamais perime, jamais a invalider explicitement.
const ASSET_CACHE_NAME = 'memorabilius-assets-v1'
const ASSET_CACHE_MAX_ENTRIES = 200

function isBuildAsset(request) {
  return request.url.includes('/_next/static/')
}

async function trimAssetCache() {
  const cache = await caches.open(ASSET_CACHE_NAME)
  const keys = await cache.keys()
  const overflow = keys.length - ASSET_CACHE_MAX_ENTRIES
  if (overflow > 0) await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)))
}

async function handleAssetFetch(request) {
  const cache = await caches.open(ASSET_CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res.ok) {
      cache.put(request, res.clone())
      trimAssetCache()
    }
    return res
  } catch {
    return cached || Response.error()
  }
}

// Seuls les assets vraiment statiques sont pré-cachés (pas les pages Next.js)
const STATIC_ASSETS = ['/offline.html', '/icon-192.png', '/icon-512.png', '/manifest.json']

function isImageRequest(request) {
  // Avatars (profil ET équipe) sont uploadés sur un chemin fixe avec upsert
  // (ex: `${userId}/avatar.jpg`, toujours la même URL) — un cache-first sans
  // expiration comme celui-ci servirait l'ancien avatar indéfiniment après
  // un changement de photo, sur tout appareil qui l'a déjà en cache. Les
  // photos de cartes n'ont pas ce problème : chaque nouvel upload a sa
  // propre URL (timestamp dans le chemin).
  if (/\/avatar\.[a-z0-9]+(\?|$)/i.test(request.url)) return false
  if (request.destination === 'image') return true
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(request.url)
}

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const keys = await cache.keys()
  const overflow = keys.length - IMAGE_CACHE_MAX_ENTRIES
  if (overflow > 0) await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)))
}

async function handleImageFetch(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    // Beaucoup de ces images viennent d'hébergeurs tiers sans CORS (ibb.co...) —
    // la réponse est alors "opaque" (statut illisible), mais reste tout à fait
    // exploitable en tant que source d'une balise <img> et cachable telle quelle.
    if (res.ok || res.type === 'opaque') {
      cache.put(request, res.clone())
      trimImageCache()
    }
    return res
  } catch {
    return cached || Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE_NAME && k !== ASSET_CACHE_NAME).map((k) => caches.delete(k)))
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
// Un cold start Android peut avoir le réseau pas tout à fait prêt une fraction
// de seconde (DNS/radio pas encore stabilisés) — sans retry, ce blip transitoire
// bascule directement sur la page en cache, potentiellement très périmée après
// un déploiement (référence d'anciens chunks JS supprimés → React ne démarre
// même pas, donc rien ne peut se rattraper côté app). Un retry avant le fallback
// évite ça dans l'immense majorité des cas.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    if (event.request.method === 'GET' && isImageRequest(event.request)) {
      event.respondWith(handleImageFetch(event.request))
    } else if (event.request.method === 'GET' && isBuildAsset(event.request)) {
      event.respondWith(handleAssetFetch(event.request))
    }
    return
  }
  event.respondWith(
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(event.request)
          if (res.ok) {
            const cache = await caches.open(CACHE_NAME)
            cache.put(event.request, res.clone())
          }
          return res
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
        }
      }
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(event.request)
      return cached || caches.match('/offline.html')
    })()
  )
})
