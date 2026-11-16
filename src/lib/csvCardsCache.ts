import { after } from 'next/server'
import { parseCsv, type CsvCard, type RawCsvCard } from '@/lib/csvCards'
import { createServerServiceClient } from '@/lib/supabaseServer'

// Cache persistant (table csv_cards_cache) -- voir player_photo_cache dans
// espnHeadshot.ts pour le meme principe. Sans ca, une page joueur retelecharge
// et reparse le CSV de tous les profils lies a chaque visite, quel que soit
// le joueur regarde : cause de lenteur des pages joueur/recherche/checklist.
// Fichier server-only (service role + after()) -- csvCards.ts reste le
// module cote client (CardPicker.tsx) sans secret ni dependance serveur.
// Timeout (voir supabaseServer.ts) : non couvert par le rollout initial,
// qui ne ciblait que page.tsx/route.ts, pas les modules lib/ partages.
const cacheDb = createServerServiceClient()
const CSV_CACHE_TTL_MS = 3600_000

function rememberEmpty(profileId: string) {
  cacheDb.from('csv_cards_cache').upsert({ profile_id: profileId, cards: [], fetched_at: new Date().toISOString() }).then(() => {})
}

// `keepOnFail` : le profil a déjà des cartes en cache. Un échec (CSV lent ou injoignable) ne doit JAMAIS les remplacer par une liste vide :
// c'est ce qui faisait « disparaître » les cartes d'un collectionneur (ex. 70 cartes d'Iguodala affichées comme 1) jusqu'au prochain téléchargement réussi.
function failed(profileId: string, keepOnFail: boolean) {
  if (keepOnFail) cacheDb.from('csv_cards_cache').update({ fetched_at: new Date().toISOString() }).eq('profile_id', profileId).then(() => {})
  else rememberEmpty(profileId)
}

async function fetchAndCacheCsv(profileId: string, url: string, timeoutMs = 4000, keepOnFail = false): Promise<RawCsvCard[]> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 3600 } })
    if (!r.ok) { failed(profileId, keepOnFail); return [] }
    const cards = parseCsv(await r.text())
    cacheDb.from('csv_cards_cache').upsert({ profile_id: profileId, cards, fetched_at: new Date().toISOString() }).then(() => {})
    return cards
  } catch {
    // CSV injoignable : mémorisé pour ne pas être retenté (et ne pas bloquer la page) à CHAQUE visite, SANS effacer les cartes déjà en cache
    failed(profileId, keepOnFail)
    return []
  }
}

// Tire les URLs de la file `items` au fur et a mesure, `workers` a la fois
// en parallele, en s'arretant des que `deadline` est depassee (les fetch deja
// lances vont au bout de leur propre timeout, mais aucun nouveau ne demarre)
// -- des fetch() simultanes vers des Google Sheets publiees se faisaient
// rate-limiter/timeout en masse, ce qui rendait chaque visite de page joueur
// lente ET peu fiable pour remplir le cache. Meme principe de pool que
// getCachedHeadshots.
async function runPooled<T>(items: T[], workers: number, deadline: number, fn: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (i < items.length && Date.now() < deadline) {
      const item = items[i++]
      await fn(item)
    }
  }))
}

// Variante server-only de fetchCsvCardsForProfiles (csvCards.ts), avec cache
// persistant. A utiliser depuis les Server Components / Route Handlers
// (page joueur, /api/player-cards) -- jamais depuis un composant client.
export async function fetchCsvCardsForProfilesCached(
  profiles: { id: string; display_name: string; avatar_url: string | null; lien_csv: string | null; couleur_bordure?: string | null }[],
  deadline = Date.now() + 2_000
): Promise<CsvCard[]> {
  const withCsv = profiles.filter(p => p.lien_csv)
  if (withCsv.length === 0) return []

  const { data: cached, error: cacheErr } = await cacheDb
    .from('csv_cards_cache')
    .select('profile_id, cards, fetched_at')
    .in('profile_id', withCsv.map(p => p.id))
  if (cacheErr) console.log('[csv-cache] erreur de lecture du cache :', cacheErr.message, `(${withCsv.length} profils demandés)`)
  const cachedById = new Map((cached || []).map(r => [r.profile_id, r]))

  const rawByProfile = new Map<string, RawCsvCard[]>()
  const toRefreshStale: typeof withCsv = []
  const toFetchNow: typeof withCsv = []
  for (const p of withCsv) {
    const row = cachedById.get(p.id)
    if (!row) { toFetchNow.push(p); continue }
    rawByProfile.set(p.id, row.cards as RawCsvCard[])
    if (Date.now() - new Date(row.fetched_at).getTime() >= CSV_CACHE_TTL_MS) toRefreshStale.push(p)
  }

  // Jamais de cache du tout (nouveau profil CSV) : on doit attendre le fetch
  // live pour ne pas afficher 0 carte, mais en pool limite + budget de temps
  // pour ne pas se faire rate-limiter et pour que les autres cartes (deja en
  // cache) s'affichent sans attendre les CSV les plus lents/morts -- ceux non
  // tentes a temps seront retentes a la prochaine visite.
  await Promise.race([
    runPooled(toFetchNow, 8, deadline, async p => {
      rawByProfile.set(p.id, await fetchAndCacheCsv(p.id, p.lien_csv!))
    }),
    new Promise<void>(res => setTimeout(res, Math.max(0, deadline - Date.now()))),   // la page n'attend jamais plus que le budget, même si un téléchargement traîne
  ])
  // pas encore récupérés dans le budget : téléchargés après l'envoi de la page, prêts pour la visite suivante
  const missing = toFetchNow.filter(p => !rawByProfile.has(p.id))
  if (missing.length > 0) {
    after(() => runPooled(missing, 8, Date.now() + 60_000, async p => { await fetchAndCacheCsv(p.id, p.lien_csv!, 9000, false) }))
  }

  // Cache perime mais present : on sert tout de suite les donnees en cache
  // (page rapide) et on rafraichit apres l'envoi de la reponse (after()),
  // pour ne pas se faire tuer en cours de route par la fin de l'invocation
  // serverless comme un simple fire-and-forget non attendu.
  if (toRefreshStale.length > 0) {
    after(() => runPooled(toRefreshStale, 8, Date.now() + 60_000, async p => { await fetchAndCacheCsv(p.id, p.lien_csv!, 9000, true) }))
  }

  const pendingCount = missing.length
  const all: CsvCard[] = []
  for (const p of withCsv) {
    for (const raw of rawByProfile.get(p.id) || []) {
      all.push({ ...raw, user_id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, accent: p.couleur_bordure || '#003DA6' })
    }
  }
  // `pending` : nombre de CSV pas encore prêts (téléchargés après l'envoi de la page) ; une page qui en dépend ne doit PAS être gardée en cache longtemps
  return Object.assign(all, { pending: pendingCount })
}
