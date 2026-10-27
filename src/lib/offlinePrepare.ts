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

export interface PrepState {
  at: number          // dernière préparation des pages (ms)
  pages: number
  images: number      // images mises en cache
  imagesTotal: number // images à mettre en cache
  imagesDone: boolean
}
export interface PrepProgress { phase: 'pages' | 'images'; done: number; total: number }

export function readPrepState(): PrepState | null {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') } catch { return null }
}

function saveState(s: PrepState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* stockage plein */ }
  window.dispatchEvent(new Event(PREP_EVENT))
}

// Vide l'état mémorisé (déconnexion / désactivation).
export function clearPrepState() {
  try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
  window.dispatchEvent(new Event(PREP_EVENT))
}

// Onglets de la galerie dont les données ne se chargent qu'au clic : on les
// ouvre un par un pour que le service worker les enregistre aussi. Repérés par
// leur texte (même iframe, même origine -> le DOM est accessible).
const GALLERY_TABS = ['classeurs', 'objectifs', 'badges', 'commentaires']

async function openGalleryTabs(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument
    if (!doc) return
    for (const tab of GALLERY_TABS) {
      if (!navigator.onLine) return
      const btn = [...doc.querySelectorAll('button')].find(b => (b.textContent || '').trim().toLowerCase() === tab)
      if (!btn) continue
      btn.click()
      await new Promise(r => setTimeout(r, 4000)) // le temps que l'onglet charge ses données
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
    setTimeout(done, 90000) // garde-fou : page qui ne finit jamais de charger
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

async function listUserImages(userId: string): Promise<string[]> {
  const urls = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('cartes_manuelles')
      .select('image_recto').eq('user_id', userId).order('created_at', { ascending: true }).range(from, from + 999)
    if (error || !data) break
    for (const row of data) {
      const u = row.image_recto
      if (u && !u.includes('placehold.co')) urls.add(u)
    }
    if (data.length < 1000) break
  }
  return [...urls]
}

let running = false

export async function prepareOffline(
  userId: string,
  opts: { images: boolean; onProgress?: (p: PrepProgress) => void },
): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    const previous = readPrepState()
    const galleryPath = await resolveGalleryUrl(userId)
    const pages = ['/', galleryPath]
    for (let i = 0; i < pages.length; i++) {
      if (!navigator.onLine) return
      opts.onProgress?.({ phase: 'pages', done: i, total: pages.length })
      const isGallery = pages[i] === galleryPath
      await loadInIframe(pages[i], isGallery ? 12000 : 5000, { openTabs: isGallery })
    }
    saveState({
      at: Date.now(), pages: pages.length,
      images: previous?.images ?? 0, imagesTotal: previous?.imagesTotal ?? 0, imagesDone: previous?.imagesDone ?? false,
    })

    if (!opts.images) return

    const all = await listUserImages(userId)
    const cache = await caches.open('memorabilius-images-v1')
    const todo: string[] = []
    for (const u of all) { if (!(await cache.match(u))) todo.push(u) }

    const cachedAlready = all.length - todo.length
    let done = 0
    const report = () => {
      opts.onProgress?.({ phase: 'images', done: cachedAlready + done, total: all.length })
      saveState({ at: Date.now(), pages: pages.length, images: cachedAlready + done, imagesTotal: all.length, imagesDone: false })
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
    saveState({ at: Date.now(), pages: pages.length, images: cachedAlready + done, imagesTotal: all.length, imagesDone: complete })
    opts.onProgress?.({ phase: 'images', done: cachedAlready + done, total: all.length })
  } finally {
    running = false
  }
}
