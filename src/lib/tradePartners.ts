import type { SupabaseClient } from '@supabase/supabase-js'
import { cardMatchesWish } from '@/lib/tradeMatches'

// « Chercher les meilleurs partenaires » : croise les collections (toutes les cartes, avec un indicateur « à vendre / échanger »)
// et les wishlists des membres avec les miennes, puis classe les membres. Lecture seule. Les cartes privées sont exclues.

const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const CARD_COLS = 'id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch, image_recto, valeur, equipe, disponible_vente'
const WISH_COLS = 'id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch'
const PAGE = 1000
const MAX_ROWS = 40000 // garde-fou : on ne charge jamais plus que cela en mémoire

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1)
    if (!data?.length) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

type Row = Record<string, any>
const sumValue = (cards: Row[]) => cards.reduce((a, c) => a + (Number(c.valeur) || 0), 0)

export type Partner = {
  id: string; name: string; avatar: string | null
  score: number; perfect: boolean
  theyHave: Row[]; theyWantFromMe: Row[]
  theyHaveValue: number; theyWantValue: number
  balanced: boolean
  theyHaveForTrade: number; theyWantForTrade: number
}

const cache = new Map<string, { at: number; scannedMembers: number; partners: Partner[] }>()
const CACHE_MS = 10 * 60 * 1000

export async function computePartners(supabase: SupabaseClient, userId: string, force = false) {
  const hit = cache.get(userId)
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return { partners: hit.partners, scannedMembers: hit.scannedMembers, cachedAt: hit.at }

  // Toutes les cartes de la collection comptent (pas seulement celles à vendre) ; celles marquées « à vendre / échanger »
  // pèsent plus dans le score et sont signalées dans l'interface.
  const [myWishes, myCards] = await Promise.all([
    fetchAll<Row>((a, b) => supabase.from('wishlist').select(WISH_COLS).eq('user_id', userId).range(a, b)),
    fetchAll<Row>((a, b) => supabase.from('cartes_manuelles').select(CARD_COLS).eq('user_id', userId).range(a, b)),
  ])
  if (!myWishes.length && !myCards.length) return { partners: [] as Partner[], scannedMembers: 0, cachedAt: Date.now() }

  // Cartes des autres qui portent le nom d'une carte de ma wishlist (par lots de noms : on ne charge pas les 118 000 cartes)
  const wishNames = [...new Set(myWishes.map(w => String(w.nom || '').trim()).filter(Boolean))]
  const likeSafe = (s: string) => s.replace(/[%_\\]/g, c => `\\${c}`).replace(/[,()"]/g, ' ')
  const theirCardsPromise = (async () => {
    const out: Row[] = []
    for (let i = 0; i < wishNames.length && out.length < MAX_ROWS; i += 25) {
      const orFilter = wishNames.slice(i, i + 25).map(n => `nom.ilike.${likeSafe(n)}`).join(',')
      out.push(...await fetchAll<Row>((a, b) => supabase.from('cartes_manuelles').select(CARD_COLS).neq('user_id', userId).or(orFilter).range(a, b)))
    }
    return out
  })()
  const [allCards, allWishes, privees] = await Promise.all([
    theirCardsPromise,
    fetchAll<Row>((a, b) => supabase.from('wishlist').select(WISH_COLS).neq('user_id', userId).range(a, b)),
    fetchAll<Row>((a, b) => supabase.from('cartes_privees').select('user_id, card_key').range(a, b)),
  ])
  const priv = new Set(privees.map(p => `${p.user_id}::${p.card_key}`))
  const cards = allCards.filter(c => !priv.has(`${c.user_id}::${c.image_recto}`))

  // index par nom normalisé : évite de comparer chaque carte à chaque wishlist
  const myWishByName = new Map<string, Row[]>()
  for (const w of myWishes) { const k = normalize(w.nom); if (k) myWishByName.set(k, [...(myWishByName.get(k) || []), w]) }
  const wishByName = new Map<string, Row[]>()
  for (const w of allWishes) { const k = normalize(w.nom); if (k) wishByName.set(k, [...(wishByName.get(k) || []), w]) }

  const byMember = new Map<string, { theyHave: Map<string, Row>; theyWant: Map<string, Row> }>()
  const slot = (id: string) => { if (!byMember.has(id)) byMember.set(id, { theyHave: new Map(), theyWant: new Map() }); return byMember.get(id)! }

  // ce qu'ils ont et que je cherche
  for (const c of cards) {
    const ws = myWishByName.get(normalize(c.nom))
    if (ws?.some(w => cardMatchesWish(c, w))) slot(c.user_id).theyHave.set(c.id, c)
  }
  // ce que j'ai et qu'ils cherchent
  for (const c of myCards) {
    const ws = wishByName.get(normalize(c.nom))
    if (!ws) continue
    for (const w of ws) if (cardMatchesWish(c, w)) slot(w.user_id).theyWant.set(c.id, c)
  }

  const ids = [...byMember.keys()]
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids) : { data: [] as Row[] }
  const pm = new Map((profiles || []).map((p: Row) => [p.id, p]))

  const partners: Partner[] = ids.map(id => {
    const { theyHave: h, theyWant: w } = byMember.get(id)!
    const theyHave = [...h.values()], theyWantFromMe = [...w.values()]
    const vh = sumValue(theyHave), vw = sumValue(theyWantFromMe)
    const perfect = theyHave.length > 0 && theyWantFromMe.length > 0
    const both = vh > 0 && vw > 0
    const gap = both ? Math.abs(vh - vw) / Math.max(vh, vw) : 1
    const balanced = both && gap <= 0.15
    // cartes qui se croisent dans les deux sens (le plus important), puis volume total, puis équilibre des valeurs
    // une carte marquée « à vendre / échanger » compte 1, une carte simplement présente dans la collection compte 0,6
    const weigh = (cs: Row[]) => cs.reduce((a, c) => a + (c.disponible_vente ? 1 : 0.6), 0)
    const wh = weigh(theyHave), ww = weigh(theyWantFromMe)
    const score = Math.min(100, Math.round(
      Math.min(wh, ww) * 22 +
      Math.min(wh + ww, 10) * 3 +
      (both ? (1 - Math.min(gap, 1)) * 20 : 0),
    ))
    return {
      id, name: pm.get(id)?.display_name || 'Collector', avatar: pm.get(id)?.avatar_url || null,
      score, perfect, theyHave, theyWantFromMe, theyHaveValue: vh, theyWantValue: vw, balanced,
      theyHaveForTrade: theyHave.filter(c => c.disponible_vente).length,
      theyWantForTrade: theyWantFromMe.filter(c => c.disponible_vente).length,
    }
  }).sort((a, b) => b.score - a.score).slice(0, 30)

  const scannedMembers = new Set([...cards.map(c => c.user_id), ...allWishes.map(w => w.user_id)]).size
  const at = Date.now()
  cache.set(userId, { at, scannedMembers, partners })
  return { partners, scannedMembers, cachedAt: at }
}
