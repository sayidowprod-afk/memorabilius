// Sources externes pour les cartes à jouer : TCGdex (Pokémon, prix Cardmarket en euros) et Scryfall (Magic, prix en euros).
// Utilisé côté serveur uniquement (routes /api/tcg/*) : on n'envoie jamais le navigateur du membre vers ces services, on met leurs réponses en cache.
import type { TcgGameId } from '@/lib/tcgGames'

export interface TcgPrice { eur: number | null; eurFoil: number | null; low: number | null; avg: number | null; updated?: string | null; source: 'cardmarket' | 'scryfall' }
export interface TcgHit {
  game: TcgGameId; ref: string; name: string
  set: string; setId: string; number: string; rarity: string; year?: string
  image?: string; language: string; price?: TcgPrice
  finishes?: string[]
}

const UA = 'Memorabilius/1.0 (collection manager; https://www.memorabilius.fr)'
const TCGDEX_LANGS: Record<string, string> = { FR: 'fr', EN: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', JP: 'ja', KO: 'ko', ZH: 'zh-tw' }

async function getJson<T>(url: string, init?: RequestInit, ms = 5000): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers || {}) }, signal: AbortSignal.timeout(ms), next: { revalidate: 43200 } } as RequestInit)
    return r.ok ? ((await r.json()) as T) : null
  } catch { return null }
}
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v !== '' && isFinite(Number(v)) ? Number(v) : null)

// ── Pokémon (TCGdex)
interface DexCardLite { id: string; localId: string; name: string; image?: string }
interface DexCard extends DexCardLite {
  rarity?: string
  set?: { id: string; name: string; cardCount?: { total?: number; official?: number } }
  pricing?: { cardmarket?: { updated?: string; unit?: string; avg?: number | null; low?: number | null; trend?: number | null; 'trend-holo'?: number | null; 'avg-holo'?: number | null; 'low-holo'?: number | null } }
  variants?: { normal?: boolean; reverse?: boolean; holo?: boolean; firstEdition?: boolean }
}
const setYearCache = new Map<string, string>()
async function dexSetYear(lang: string, setId: string): Promise<string | undefined> {
  if (setYearCache.has(setId)) return setYearCache.get(setId)
  const s = await getJson<{ releaseDate?: string }>(`https://api.tcgdex.net/v2/${lang}/sets/${encodeURIComponent(setId)}`)
  const y = s?.releaseDate?.slice(0, 4)
  if (y) setYearCache.set(setId, y)
  return y
}
function dexToHit(c: DexCard, language: string, year?: string): TcgHit {
  const cm = c.pricing?.cardmarket
  const finishes: string[] = []
  if (c.variants?.normal) finishes.push('Normale')
  if (c.variants?.reverse) finishes.push('Reverse holo')
  if (c.variants?.holo) finishes.push('Holo')
  const total = c.set?.cardCount?.official ?? c.set?.cardCount?.total
  return {
    game: 'pokemon', ref: c.id, name: c.name, set: c.set?.name || '', setId: c.set?.id || '',
    number: total ? `${c.localId}/${total}` : c.localId, rarity: c.rarity || '', year, language,
    image: c.image ? `${c.image}/low.webp` : undefined, finishes,
    price: cm ? { eur: num(cm.trend) ?? num(cm.avg), eurFoil: num(cm['trend-holo']), low: num(cm.low), avg: num(cm.avg), updated: cm.updated ?? null, source: 'cardmarket' } : undefined,
  }
}
export async function searchPokemon(q: string, language = 'FR', limit = 8): Promise<TcgHit[]> {
  const lang = TCGDEX_LANGS[language] || 'fr'
  const list = await getJson<DexCardLite[]>(`https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(q)}&pagination:page=1&pagination:itemsPerPage=${limit}`)
  if (!list?.length) return []
  const details = await Promise.all(list.map(l => getJson<DexCard>(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(l.id)}`)))
  const cards = details.filter((c): c is DexCard => !!c)
  const years = await Promise.all(cards.map(c => (c.set?.id ? dexSetYear(lang, c.set.id) : Promise.resolve(undefined))))
  return cards.map((c, i) => dexToHit(c, language, years[i]))
}
export async function pokemonByRef(ref: string, language = 'FR'): Promise<TcgHit | null> {
  const lang = TCGDEX_LANGS[language] || 'fr'
  const c = await getJson<DexCard>(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(ref)}`)
  return c ? dexToHit(c, language, c.set?.id ? await dexSetYear(lang, c.set.id) : undefined) : null
}

// ── Magic (Scryfall)
interface ScryCard {
  id: string; name: string; set: string; set_name: string; collector_number: string; rarity: string; released_at?: string; lang?: string
  image_uris?: { small?: string; normal?: string }; card_faces?: { image_uris?: { small?: string; normal?: string } }[]
  prices?: { eur?: string | null; eur_foil?: string | null }; finishes?: string[]
}
const RARITY_FR: Record<string, string> = { common: 'Commune', uncommon: 'Peu commune', rare: 'Rare', mythic: 'Mythique', special: 'Spéciale', bonus: 'Spéciale' }
function scryToHit(c: ScryCard): TcgHit {
  const finishes = (c.finishes || []).map(f => (f === 'nonfoil' ? 'Normale' : f === 'foil' ? 'Foil' : f === 'etched' ? 'Etched' : f))
  return {
    game: 'mtg', ref: c.id, name: c.name, set: c.set_name, setId: c.set, number: c.collector_number, rarity: RARITY_FR[c.rarity] || c.rarity,
    year: c.released_at?.slice(0, 4), language: (c.lang || 'en').toUpperCase(),
    image: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small, finishes,
    price: { eur: num(c.prices?.eur), eurFoil: num(c.prices?.eur_foil), low: null, avg: null, updated: null, source: 'scryfall' },
  }
}
export async function searchMtg(q: string, limit = 8): Promise<TcgHit[]> {
  const r = await getJson<{ data?: ScryCard[] }>(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${q}" OR name:${q}`)}&unique=prints&order=released&dir=desc`)
  return (r?.data || []).slice(0, limit).map(scryToHit)
}
export async function mtgByRef(ref: string): Promise<TcgHit | null> {
  const c = await getJson<ScryCard>(`https://api.scryfall.com/cards/${encodeURIComponent(ref)}`)
  return c ? scryToHit(c) : null
}

export async function searchTcg(game: TcgGameId, q: string, language = 'FR', limit = 8): Promise<TcgHit[]> {
  if (game === 'pokemon') return searchPokemon(q, language, limit)
  if (game === 'mtg') return searchMtg(q, limit)
  return []
}
export async function tcgByRef(game: TcgGameId, ref: string, language = 'FR'): Promise<TcgHit | null> {
  if (game === 'pokemon') return pokemonByRef(ref, language)
  if (game === 'mtg') return mtgByRef(ref)
  return null
}
