import type { SupabaseClient } from '@supabase/supabase-js'

// Stats « cartes » mondiales d'un joueur : catalogue (base TCDB importée) + annonces eBay en cours.
// Les prix eBay sont des PRIX DEMANDÉS (annonces actives), pas des ventes conclues.

export type Seg = { n: number; median: number; min: number; max: number }
export type CardMarket = {
  at: string
  catalog: {
    total: number; sets: number; rc: number; auto: number; patch: number
    firstYear: number | null; lastYear: number | null
    topSets: Array<{ name: string; year: number | null; count: number }>
    topBrands: Array<{ brand: string; count: number }>
  } | null
  market: {
    currency: 'USD' // les prix mémorisés restent en dollars (eBay US) ; l'affichage les convertit avec usdToEur
    usdToEur?: number // taux du jour au moment du calcul (absent sur les anciens calculs -> taux par défaut)
    listings: number | null
    all: Seg | null; rc: Seg | null; auto: Seg | null; patch: Seg | null; psa10: Seg | null
  } | null
}

// ── Euros ────────────────────────────────────────────────────────────────────
export const DEFAULT_USD_EUR = 0.86
// Prix affiché en euros : taux enregistré avec les stats (ou taux par défaut pour les anciens calculs).
export const toEur = (usd: number, m: { usdToEur?: number } | null | undefined) => usd * (m?.usdToEur ?? DEFAULT_USD_EUR)
export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n < 100 ? 2 : 0 })

// Taux du jour (Banque centrale européenne via frankfurter.app, gratuit, sans clé). Repli sur le taux par défaut.
async function usdToEurRate(): Promise<number> {
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    const j = await r.json()
    const v = Number(j?.rates?.EUR)
    return Number.isFinite(v) && v > 0.5 && v < 1.5 ? v : DEFAULT_USD_EUR
  } catch { return DEFAULT_USD_EUR }
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// ── Catalogue TCDB ───────────────────────────────────────────────────────────
type Entry = { set_id: number; is_rc: boolean | null; is_auto: boolean | null; variation: string | null }

export async function catalogStats(admin: SupabaseClient, playerName: string): Promise<CardMarket['catalog']> {
  const safe = playerName.trim().replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ')
  if (safe.length < 3) return null
  const rows: Entry[] = []
  const PAGE = 1000
  for (let from = 0; from < 30000; from += PAGE) {
    const { data, error } = await admin.from('card_set_entries').select('set_id, is_rc, is_auto, variation')
      .ilike('player_name', safe).order('id').range(from, from + PAGE - 1)
    if (error || !data) break
    rows.push(...(data as Entry[]))
    if (data.length < PAGE) break
  }
  if (!rows.length) return null

  let rc = 0, auto = 0, patch = 0
  const perSet = new Map<number, number>()
  for (const r of rows) {
    if (r.is_rc) rc++
    if (r.is_auto) auto++
    const v = (r.variation || '').toLowerCase()
    if (/patch|jersey|relic|logoman|swatch/.test(v)) patch++
    perSet.set(r.set_id, (perSet.get(r.set_id) ?? 0) + 1)
  }

  const ids = [...perSet.keys()]
  const sets: Array<{ id: number; name: string; year: number | null; brand: string | null }> = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('card_sets').select('id, name, year, brand').in('id', ids.slice(i, i + 200))
    if (data) sets.push(...data)
  }
  const years = sets.map(s => s.year).filter((y): y is number => typeof y === 'number' && y > 1900)
  const brandCount = new Map<string, number>()
  for (const s of sets) if (s.brand) brandCount.set(s.brand, (brandCount.get(s.brand) ?? 0) + (perSet.get(s.id) ?? 0))

  return {
    total: rows.length, sets: perSet.size, rc, auto, patch,
    firstYear: years.length ? Math.min(...years) : null, lastYear: years.length ? Math.max(...years) : null,
    topSets: sets.map(s => ({ name: s.name, year: s.year, count: perSet.get(s.id) ?? 0 })).sort((a, b) => b.count - a.count).slice(0, 5),
    topBrands: [...brandCount.entries()].map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count).slice(0, 4),
  }
}

// ── Annonces eBay en cours ───────────────────────────────────────────────────
let tokenCache: { value: string; exp: number } | null = null
async function ebayToken(): Promise<string | null> {
  const appId = process.env.EBAY_APP_ID, certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return null
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.value
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    cache: 'no-store',
  })
  const d = await res.json().catch(() => ({}))
  if (!d.access_token) return null
  tokenCache = { value: d.access_token, exp: Date.now() + 55 * 60 * 1000 }
  return d.access_token
}

const BASKETBALL_CARDS = '214' // catégorie eBay « Basketball Cards »
const LOT_WORDS = /\b(lot|lots|bundle|collection|break|case|box|pack|packs|reprint|custom|proxy)\b/i

function stats(prices: number[]): Seg | null {
  if (!prices.length) return null
  const s = [...prices].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  // écarte les prix aberrants (carte vendue en lot, erreur de saisie…)
  const kept = s.filter(p => p >= median * 0.15 && p <= median * 5)
  if (!kept.length) return null
  const m2 = Math.floor(kept.length / 2)
  const med = kept.length % 2 ? kept[m2] : (kept[m2 - 1] + kept[m2]) / 2
  return { n: kept.length, median: Math.round(med * 100) / 100, min: kept[0], max: kept[kept.length - 1] }
}

async function search(token: string, q: string, titleOk: (t: string) => boolean, lastName: string): Promise<{ seg: Seg | null; total: number | null }> {
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=${BASKETBALL_CARDS}&filter=buyingOptions:{FIXED_PRICE|BEST_OFFER}&limit=100`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Content-Type': 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return { seg: null, total: null }
  const body = await res.json().catch(() => ({}))
  const items: Array<{ title?: string; price?: { value?: string; currency?: string } }> = body.itemSummaries || []
  const prices: number[] = []
  for (const it of items) {
    const t = it.title || ''
    if (!norm(t).includes(lastName) || LOT_WORDS.test(t) || !titleOk(t)) continue
    if (it.price?.currency !== 'USD') continue
    const p = Number(it.price.value)
    if (Number.isFinite(p) && p > 0) prices.push(p)
  }
  return { seg: stats(prices), total: typeof body.total === 'number' ? body.total : null }
}

export async function marketStats(playerName: string): Promise<CardMarket['market']> {
  const token = await ebayToken()
  if (!token) return null
  const name = playerName.trim()
  const last = norm(name).split(' ').filter(Boolean).pop() || ''
  if (last.length < 2) return null
  const any = () => true
  const [all, rc, auto, patch, psa10] = await Promise.all([
    search(token, name, any, last),
    search(token, `${name} rookie rc`, t => /\brc\b|rookie/i.test(t), last),
    search(token, `${name} auto autograph`, t => /auto|signed|signature/i.test(t), last),
    search(token, `${name} patch jersey`, t => /patch|jersey|relic|logoman/i.test(t), last),
    search(token, `${name} PSA 10`, t => /psa\s*10/i.test(t), last),
  ])
  return { currency: 'USD', usdToEur: await usdToEurRate(), listings: all.total, all: all.seg, rc: rc.seg, auto: auto.seg, patch: patch.seg, psa10: psa10.seg }
}

export async function buildCardMarket(admin: SupabaseClient, playerName: string): Promise<CardMarket> {
  const [catalog, market] = await Promise.all([
    catalogStats(admin, playerName).catch(() => null),
    marketStats(playerName).catch(() => null),
  ])
  return { at: new Date().toISOString(), catalog, market }
}
