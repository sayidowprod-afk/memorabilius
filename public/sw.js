const CACHE_NAME = 'memorabilius-v8'

// Mode hors ligne (consultation) : tout ce qui suit est "réseau d'abord".
// RÈGLE ABSOLUE (cf. l'historique de gels sur certains Android avec un
// cache-first) : quand il y a du réseau, on ne fait JAMAIS un `await` sur
// l'API Cache avant de répondre -- la réponse réseau part tout de suite et
// l'écriture en cache se fait derrière, via waitUntil. Le cache n'est lu
// qu'en secours (réseau coupé / mode avion / fetch qui échoue).
//  - RUNTIME : chunks JS/CSS/polices, payloads RSC de navigation interne
//  - DATA    : lectures Supabase (GET /rest/v1), séparées PAR UTILISATEUR
//              (voir dataCacheKey) -- purgé à la déconnexion
const RUNTIME_CACHE_NAME = 'memorabilius-runtime-v1'
const RUNTIME_CACHE_MAX_ENTRIES = 600
const DATA_CACHE_NAME = 'memorabilius-data-v1'
const DATA_CACHE_MAX_ENTRIES = 600

// Cache séparé pour les photos de cartes (Supabase Storage, ibb.co, etc.) —
// cache-first : une fois une carte vue, sa photo reste dispo hors-ligne même
// après redémarrage de l'app (le cache HTTP navigateur normal n'offre pas
// cette garantie, surtout dans une WebView qui purge plus agressivement).
// Volontairement séparé du cache HTML/statique ci-dessus, qui lui reste
// network-first (voir commentaire plus bas sur les risques de chunks JS
// périmés) — les photos n'ont pas ce risque, une image ne "casse" jamais.
const IMAGE_CACHE_NAME = 'memorabilius-images-v1'
const IMAGE_CACHE_MAX_ENTRIES = 1500

// HISTORIQUE : un ancien cache-first sur /_next/static/* (chunks JS) avait gele
// l'app sur certains Android (Cache Storage API bloque sans jamais rejeter, ou
// contexte du SW suspendu par l'OS -- aucun timeout interne au SW ne peut s'en
// sortir). Il avait ete retire entierement. Les chunks sont de nouveau
// interceptes pour le mode hors ligne, mais en reseau-d'abord uniquement (voir
// la regle en tete de fichier) -- et ce SW n'est PAS enregistre dans l'app
// native (voir PWAInstall.tsx), qui est precisement la ou le gel a ete observe.
// Si un gel reapparait sur le web/PWA, la premiere chose a faire est de
// retirer la branche isRuntimeAsset() du gestionnaire fetch plus bas.

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

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const overflow = keys.length - maxEntries
  if (overflow > 0) await Promise.all(keys.slice(0, overflow).map((k) => cache.delete(k)))
}

function trimImageCache() {
  return trimCache(IMAGE_CACHE_NAME, IMAGE_CACHE_MAX_ENTRIES)
}

// Écrit en cache APRÈS que la réponse soit partie (voir la règle ci-dessus).
async function putAndTrim(cacheName, key, response, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(key, response)
    await trimCache(cacheName, maxEntries)
  } catch { /* quota plein / cache indisponible : on s'en passe, le réseau a déjà répondu */ }
}

// Lecture du cache en secours. Plafonnée à 4s : un Cache Storage qui ne
// répond jamais (déjà observé sur certains Android) ne doit pas laisser la
// page figée hors ligne -- au pire on retombe sur offline.html / l'erreur
// réseau, au lieu d'un écran blanc sans fin.
function cachedResponse(cacheName, key, options) {
  const read = (async () => {
    try {
      const cache = await caches.open(cacheName)
      return await cache.match(key, options)
    } catch {
      return undefined
    }
  })()
  const timeout = new Promise((resolve) => setTimeout(() => resolve(undefined), 4000))
  return Promise.race([read, timeout])
}

// Réseau d'abord. Hors ligne déclaré (mode avion) : on saute le fetch qui
// échouerait de toute façon et on sert directement le cache s'il y a une copie.
async function networkFirst(event, request, cacheName, key, maxEntries) {
  if (!self.navigator.onLine) {
    const hit = await cachedResponse(cacheName, key)
    if (hit) return hit
  }
  try {
    const res = await fetch(request)
    if (res.ok) event.waitUntil(putAndTrim(cacheName, key, res.clone(), maxEntries))
    return res
  } catch (err) {
    const hit = await cachedResponse(cacheName, key)
    if (hit) return hit
    throw err
  }
}

// Les réponses Supabase dépendent de l'utilisateur (RLS) : une même URL peut
// renvoyer des données différentes selon la session. La clé de cache inclut
// donc l'identifiant (`sub`) lu dans le JWT -- jamais de mélange entre deux
// comptes sur un même appareil. Le JWT n'est pas vérifié ici : il ne sert que
// d'étiquette de cache, jamais à autoriser quoi que ce soit.
function userIdFromRequest(request) {
  try {
    const auth = request.headers.get('authorization') || ''
    const jwt = auth.replace(/^Bearer\s+/i, '')
    const payload = jwt.split('.')[1]
    if (!payload) return 'anon'
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).sub || 'anon'
  } catch {
    return 'anon'
  }
}

function dataCacheKey(request) {
  return new Request('https://sw-data.invalid/' + userIdFromRequest(request) + '/' + encodeURIComponent(request.url))
}

function isSupabaseRead(request, url) {
  return request.method === 'GET' && /\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/rest/v1/')
}

function isRuntimeAsset(request, url) {
  if (url.origin !== self.location.origin || request.method !== 'GET') return false
  if (url.pathname.startsWith('/_next/static/')) return true
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return true
  return ['font', 'style', 'script'].includes(request.destination)
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
      // 'memorabilius-assets-v1' (ancien cache de chunks JS, retire) est volontairement
      // absent de cette liste : il sera nettoye comme n'importe quel cache perime, sur
      // les appareils qui l'avaient encore.
      Promise.all(keys.filter((k) => ![CACHE_NAME, IMAGE_CACHE_NAME, RUNTIME_CACHE_NAME, DATA_CACHE_NAME].includes(k)).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Déconnexion : le client demande d'effacer les données mises en cache pour
// l'utilisateur (appareil partagé -- le suivant ne doit rien retrouver).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_USER_DATA') {
    event.waitUntil(caches.delete(DATA_CACHE_NAME))
  }
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
// Les lectures Supabase (GET /rest/v1) sont gardées en secours hors ligne,
// par utilisateur (voir plus haut) ; /api/* et toute écriture restent en direct.
// Un cold start Android peut avoir le réseau pas tout à fait prêt une fraction
// de seconde (DNS/radio pas encore stabilisés) — sans retry, ce blip transitoire
// bascule directement sur la page en cache, potentiellement très périmée après
// un déploiement (référence d'anciens chunks JS supprimés → React ne démarre
// même pas, donc rien ne peut se rattraper côté app). Un retry avant le fallback
// évite ça dans l'immense majorité des cas.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    const url = new URL(event.request.url)

    // Lectures Supabase (données de la collection) : réseau d'abord, copie
    // locale par utilisateur en secours hors ligne.
    if (isSupabaseRead(event.request, url)) {
      event.respondWith(networkFirst(event, event.request, DATA_CACHE_NAME, dataCacheKey(event.request), DATA_CACHE_MAX_ENTRIES))
      return
    }

    // Chunks JS/CSS/polices et payloads RSC (navigation interne) : sans eux
    // une page en cache ne démarre pas hors ligne. Réseau d'abord, jamais de
    // cache-first (voir règle en tête de fichier).
    if (isRuntimeAsset(event.request, url)) {
      event.respondWith(networkFirst(event, event.request, RUNTIME_CACHE_NAME, event.request, RUNTIME_CACHE_MAX_ENTRIES))
      return
    }

    if (event.request.method === 'GET' && isImageRequest(event.request)) {
      // Une requete explicitement CORS (crossOrigin="anonymous", ex: canvas de
      // l'export video) a besoin d'une vraie reponse CORS lisible -- jamais d'une
      // reponse opaque mise en cache par une precedente requete <img> classique
      // pour la MEME url (le Cache API ne distingue pas le mode de la requete
      // dans sa cle). Servir une reponse opaque ici "tainted" le canvas et casse
      // silencieusement canvas.captureStream() (export video vide/casse, signale
      // des que ce cache image a ete introduit le 26 aout). On laisse donc ces
      // requetes-la passer directement au reseau, en dehors du cache image --
      // qui reste pense pour l'affichage <img> classique hors-ligne uniquement.
      if (event.request.mode === 'cors') return
      event.respondWith(handleImageFetch(event.request))
    }
    return
  }
  event.respondWith(
    (async () => {
      // Mode avion déclaré : inutile d'attendre deux échecs réseau, on sert
      // tout de suite la page en cache (sinon ~1s de blanc avant le repli).
      const offlineNow = !self.navigator.onLine
      for (let attempt = 0; attempt < (offlineNow ? 0 : 2); attempt++) {
        try {
          const res = await fetch(event.request)
          if (res.ok) event.waitUntil(putAndTrim(CACHE_NAME, event.request, res.clone(), 200))
          return res
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
        }
      }
      // Même page, ou à défaut la même page sans paramètres (ex: la galerie
      // ouverte avec ?card=... retombe sur la galerie déjà visitée).
      const cached = await cachedResponse(CACHE_NAME, event.request)
        || await cachedResponse(CACHE_NAME, event.request, { ignoreSearch: true })
      return cached || caches.match('/offline.html')
    })()
  )
})
