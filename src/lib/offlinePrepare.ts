import { supabase } from '@/lib/supabase'

// Préparation du mode hors ligne : charge les pages clés de l'app et les
// vignettes de la collection AVANT d'en avoir besoin, pour que tout soit
// consultable en mode avion même sans les avoir ouvertes avant.
//
// Principe : on charge les vraies pages dans une iframe cachée. Elles tournent
// comme pour un utilisateur (requêtes Supabase, chunks JS...) et le service
// worker (public/sw.js) enregistre tout au passage, avec les bonnes clés de
// cache -- plus fiable que de réécrire ici les requêtes de chaque page.
// La galerie charge d'un coup TOUTES les cartes de l'utilisateur (pages de 1000
// lignes) : une seule visite suffit donc pour toutes les données. Restent les
// images, préchargées ensuite une par une (même URL que la grille).

const STATE_KEY = 'offline_prep_state'
export const PREP_EVENT = 'offline-prep-update'
const IMAGE_CONCURRENCY = 4

// À incrémenter quand le SW / la préparation changent de façon à invalider ce
// qui a déjà été préparé sur les appareils (sinon rien ne se relance avant 12h).
// v2 : cache des requêtes .range() (206), HEAD et RPC ; tous les onglets + une carte.
export const PREP_VERSION = 2

export interface PrepState {
  v?: number          // version de la préparation (voir PREP_VERSION)
  at: number          // dernière préparation des pages (ms)
  pages: number
  images: number      // images mises en cache
  imagesTotal: number // images à mettre en cache
  imagesDone: boolean
  hd?: number         // images HD (viewer 3D) mises en cache
  hdTotal?: number
  hdDone?: boolean
}
export interface PrepProgress { phase: 'pages' | 'images' | 'hd'; done: number; total: number }

export function readPrepState(): PrepState | null {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') } catch { return null }
}

function saveState(s: PrepState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* stockage plein */ }
  window.dispatchEvent(new Event(PREP_EVENT))
}

// Met à jour une partie de l'état en gardant le reste (images vs HD sont deux
// étapes distinctes qui ne doivent pas s'écraser mutuellement).
function patchState(patch: Partial<PrepState>) {
  const base: PrepState = readPrepState() ?? { at: 0, pages: 0, images: 0, imagesTotal: 0, imagesDone: false }
  saveState({ ...base, ...patch, v: PREP_VERSION })
}

// Vide l'état mémorisé (déconnexion / désactivation).
export function clearPrepState() {
  try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
  window.dispatchEvent(new Event(PREP_EVENT))
}

// Onglets de la galerie dont les données ne se chargent qu'au clic : on les
// ouvre un par un pour que le service worker les enregistre aussi. Repérés par
// leur texte (même iframe, même origine -> le DOM est accessible).
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// Ouvre tous les onglets de la galerie (barre `.da-tabs`, indépendant de la
// langue) puis UNE carte : la fiche carte / viewer 3D est un chunk chargé
// seulement à l'usage (next/dynamic), absent du cache tant qu'on n'en a pas
// ouvert une -- et chaque carte ouverte enregistre ses propres requêtes.
async function openGalleryTabs(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument
    if (!doc) return
    const tabs = [...doc.querySelectorAll<HTMLButtonElement>('.da-tabs button')]
    for (const btn of tabs) {
      if (!navigator.onLine) return
      btn.click()
      await wait(4000) // le temps que l'onglet charge ses données
    }
    // Retour sur l'onglet Collection (le premier) pour y ouvrir une carte.
    tabs[0]?.click()
    await wait(2500)
    const card = doc.querySelector<HTMLElement>('a[href*="?card="]')
    if (card && navigator.onLine) {
      card.click()
      await wait(9000) // chargement du chunk viewer + des infos de la carte
    }
  } catch { /* structure de page différente : on garde ce qui a déjà été chargé */ }
}

function loadInIframe(url: string, settleMs: number, opts?: { openTabs?: boolean }): Promise<void> {
  return new Promise(resolve => {
    const f = document.createElement('iframe')
    f.src = url
    f.setAttribute('aria-hidden', 'true')
    f.tabIndex = -1
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:800px;border:0;visibility:hidden;pointer-events:none'
    const done = () => { f.remove(); resolve() }
    // On laisse un délai après `load` : les données de la page arrivent après.
    f.addEventListener('load', async () => {
      await new Promise(r => setTimeout(r, settleMs))
      if (opts?.openTabs) await openGalleryTabs(f)
      done()
    }, { once: true })
    setTimeout(done, 150000) // garde-fou : page qui ne finit jamais de charger
    document.body.appendChild(f)
  })
}

// "Ma galerie" pointe vers /galerie/<uuid>, redirigé côté serveur vers
// l'adresse canonique : on retient la redirection pour le mode hors ligne.
async function resolveGalleryUrl(userId: string): Promise<string> {
  const entry = `/galerie/${userId}`
  try {
    const res = await fetch(entry, { redirect: 'follow' })
    const final = new URL(res.url)
    if (final.pathname !== entry) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'ALIAS',
        from: new URL(entry, location.origin).href,
        to: final.href,
      })
      return final.pathname
    }
  } catch { /* on retombe sur l'URL d'entrée */ }
  return entry
}

interface UserImages { grid: string[]; hd: string[] }

// grid : recto (grille) + verso, chargés en <img> classique.
// hd   : ce que charge le viewer 3D / l'export, en mode CORS -- la version HD
//        si elle existe, sinon l'image normale (comme le viewer lui-même).
async function listUserImages(userId: string): Promise<UserImages> {
  const grid = new Set<string>(), hd = new Set<string>()
  const ok = (u?: string | null) => (u && !u.includes('placehold.co') ? u : null)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('cartes_manuelles')
      .select('image_recto, image_verso, image_recto_hd, image_verso_hd')
      .eq('user_id', userId).order('created_at', { ascending: true }).range(from, from + 999)
    if (error || !data) break
    for (const row of data) {
      const r = ok(row.image_recto), v = ok(row.image_verso)
      if (r) grid.add(r)
      if (v) grid.add(v)
      const rh = ok(row.image_recto_hd) || r, vh = ok(row.image_verso_hd) || v
      if (rh) hd.add(rh)
      if (vh) hd.add(vh)
    }
    if (data.length < 1000) break
  }
  return { grid: [...grid], hd: [...hd] }
}

let running = false

export async function prepareOffline(
  userId: string,
  opts: { images: boolean; onProgress?: (p: PrepProgress) => void },
): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    const galleryPath = await resolveGalleryUrl(userId)
    const pages = ['/', galleryPath]
    for (let i = 0; i < pages.length; i++) {
      if (!navigator.onLine) return
      opts.onProgress?.({ phase: 'pages', done: i, total: pages.length })
      const isGallery = pages[i] === galleryPath
      await loadInIframe(pages[i], isGallery ? 12000 : 5000, { openTabs: isGallery })
    }
    patchState({ at: Date.now(), pages: pages.length })

    if (!opts.images) return

    const all = (await listUserImages(userId)).grid
    const cache = await caches.open('memorabilius-images-v2')
    const todo: string[] = []
    for (const u of all) { if (!(await cache.match(u))) todo.push(u) }

    const cachedAlready = all.length - todo.length
    let done = 0
    const report = () => {
      opts.onProgress?.({ phase: 'images', done: cachedAlready + done, total: all.length })
      patchState({ at: Date.now(), images: cachedAlready + done, imagesTotal: all.length, imagesDone: false })
    }
    report()

    let next = 0
    const worker = async () => {
      while (next < todo.length && navigator.onLine) {
        const url = todo[next++]
        // `new Image()` (destination "image") passe par le cache images du SW,
        // sous la même clé que la grille de la galerie.
        await new Promise<void>(resolve => { const img = new Image(); img.onload = img.onerror = () => resolve(); img.src = url })
        done++
        if (done % 25 === 0) report()
      }
    }
    await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker))

    const complete = navigator.onLine
    patchState({ at: Date.now(), images: cachedAlready + done, imagesTotal: all.length, imagesDone: complete })
    opts.onProgress?.({ phase: 'images', done: cachedAlready + done, total: all.length })
  } finally {
    running = false
  }
}

// ── HD (viewer 3D) ─────────────────────────────────────────────────────────
// Le viewer 3D affiche ses images avec de simples <img> (sans CORS) : la HD va
// donc dans le MÊME cache images que les vignettes, via new Image(). Étape À
// PART et sur demande : plusieurs Go pour une collection de quelques centaines
// de cartes.
const IMAGE_CACHE = 'memorabilius-images-v2'
const HD_CONCURRENCY = 3

export interface HdPlan {
  total: number            // images HD à avoir
  missing: number          // celles pas encore en cache
  bytes: number | null     // estimation de ce qui reste à télécharger
  free: number | null      // espace de stockage disponible sur l'appareil
}

// Taille moyenne mesurée sur un échantillon (HEAD), pas devinée.
async function averageSize(urls: string[], sample = 8): Promise<number | null> {
  if (urls.length === 0) return 0
  const step = Math.max(1, Math.floor(urls.length / sample))
  const sizes: number[] = []
  for (let i = 0; i < urls.length && sizes.length < sample; i += step) {
    try {
      const res = await fetch(urls[i], { method: 'HEAD', mode: 'cors' })
      const n = Number(res.headers.get('content-length'))
      if (n > 0) sizes.push(n)
    } catch { /* on passe à la suivante */ }
  }
  return sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null
}

export async function planHd(userId: string): Promise<HdPlan> {
  const { hd } = await listUserImages(userId)
  const cache = await caches.open(IMAGE_CACHE)
  const missing: string[] = []
  for (const u of hd) { if (!(await cache.match(u))) missing.push(u) }
  const avg = await averageSize(missing)
  let free: number | null = null
  try {
    const e = await navigator.storage?.estimate?.()
    if (e?.quota) free = e.quota - (e.usage ?? 0)
  } catch { /* estimation indisponible */ }
  return { total: hd.length, missing: missing.length, bytes: avg === null ? null : Math.round(avg * missing.length), free }
}

export async function prepareHd(
  userId: string,
  opts: { onProgress?: (p: PrepProgress) => void },
): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    // Demande à ne pas être purgé par le navigateur en cas de manque de place
    // (accordé selon l'usage du site, notamment une fois installé en PWA).
    try { await navigator.storage?.persist?.() } catch { /* ignore */ }

    const { hd } = await listUserImages(userId)
    const cache = await caches.open(IMAGE_CACHE)
    const todo: string[] = []
    for (const u of hd) { if (!(await cache.match(u))) todo.push(u) }

    const cachedAlready = hd.length - todo.length
    let done = 0
    const report = (complete = false) => {
      opts.onProgress?.({ phase: 'hd', done: cachedAlready + done, total: hd.length })
      patchState({ at: Date.now(), hd: cachedAlready + done, hdTotal: hd.length, hdDone: complete })
    }
    report()

    let next = 0
    const worker = async () => {
      while (next < todo.length && navigator.onLine) {
        const url = todo[next++]
        // Même chemin que le viewer (<img>, destination "image") -> cache images du SW.
        await new Promise<void>(resolve => { const img = new Image(); img.onload = img.onerror = () => resolve(); img.src = url })
        done++
        if (done % 10 === 0) report()
      }
    }
    await Promise.all(Array.from({ length: HD_CONCURRENCY }, worker))
    report(navigator.onLine)
  } finally {
    running = false
  }
}

// ── Vérification ───────────────────────────────────────────────────────────
// Contrôle réel de ce qui est sur l'appareil (pas seulement les compteurs
// mémorisés) : lit les caches du service worker.
export interface VerifyReport {
  home: boolean
  gallery: boolean
  viewer: boolean          // code du viewer 3D en cache
  collectionData: boolean  // lignes de la collection en cache
  dataEntries: number
  images: { cached: number; total: number }
  hd: { cached: number; total: number }
  usage: number | null     // octets utilisés par le site
}

export async function verifyOffline(userId: string): Promise<VerifyReport> {
  const pagesCache = await caches.open('memorabilius-v8')
  const pageKeys = (await pagesCache.keys()).map(r => new URL(r.url).pathname)
  const home = !!(await pagesCache.match('/', { ignoreSearch: true, ignoreVary: true }))
  const gallery = pageKeys.some(p => p.startsWith('/galerie/'))

  const dataKeys = (await (await caches.open('memorabilius-data-v2')).keys()).map(r => decodeURIComponent(r.url))
  const mine = dataKeys.filter(u => u.includes('/' + userId + '/'))
  const collectionData = mine.some(u => u.includes('cartes_manuelles'))

  // Le viewer est un chunk à part : on le reconnaît à une chaîne qui lui est propre.
  let viewer = false
  const runtime = await caches.open('memorabilius-runtime-v1')
  for (const req of await runtime.keys()) {
    if (!new URL(req.url).pathname.endsWith('.js')) continue // les chunks portent un ?dpl=...
    const res = await runtime.match(req)
    if (res && (await res.clone().text()).includes('/api/player-jersey')) { viewer = true; break }
  }

  const { grid, hd } = await listUserImages(userId)
  const imgCache = await caches.open(IMAGE_CACHE)
  const count = async (urls: string[]) => {
    let n = 0
    for (const u of urls) if (await imgCache.match(u)) n++
    return { cached: n, total: urls.length }
  }
  let usage: number | null = null
  try { usage = (await navigator.storage?.estimate?.())?.usage ?? null } catch { /* indisponible */ }

  return { home, gallery, viewer, collectionData, dataEntries: mine.length, images: await count(grid), hd: await count(hd), usage }
}
