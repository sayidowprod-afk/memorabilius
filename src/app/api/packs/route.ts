import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'
import { BASE_ODDS, PACK_CARDS, PACK_COMMONS, PACK_GUARANTEE, PACK_MAX_COMMONS, PACK_MAX, PITY_LIMIT, type PackCard, type Rarity } from '@/lib/packs'

export const maxDuration = 30
const admin = createServerServiceClient()

const COLS = 'entry_id, set_id, player_name, team, card_number, variation, is_rc, is_auto, image_url, set_name, set_year, set_brand, sport, credit_user, rarity, is_patch, print_run'
type PoolRow = { entry_id: number; set_id: number; player_name: string; team: string | null; card_number: string | null; variation: string | null; is_rc: boolean; is_auto: boolean; image_url: string; set_name: string | null; set_year: number | null; set_brand: string | null; sport: string | null; credit_user: string | null; rarity: number; is_patch?: boolean; print_run?: number | null }
type Info = { total: number; rarity: Record<string, number> }

// Infos du pot mises en cache 1 min (le pot ne change que quand on relance rebuild_pack_pool) ; 5 s en développement local
let infoCache: { at: number; v: Info } | null = null
async function poolInfo(): Promise<Info> {
  if (infoCache && Date.now() - infoCache.at < (process.env.NODE_ENV !== 'production' ? 5_000 : 60_000)) return infoCache.v
  const { data, error } = await admin.rpc('pack_pool_info')
  if (error || !data) throw new Error(error?.message || 'pot indisponible')
  infoCache = { at: Date.now(), v: data as Info }
  return infoCache.v
}

// En développement local, on peut rouvrir des packs à volonté pour tester (jamais en production)
const DEV = process.env.NODE_ENV !== 'production'

async function auth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await admin.auth.getUser(token)
  return user
}

async function creditNames(ids: (string | null)[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  const out: Record<string, string> = {}
  if (!uniq.length) return out
  const { data } = await admin.from('profiles').select('id, display_name').in('id', uniq)
  for (const p of data || []) if (p.display_name) out[p.id as string] = p.display_name as string
  return out
}

const toCard = (r: PoolRow, credits: Record<string, string>): PackCard => ({
  id: r.entry_id, setId: r.set_id, rarity: r.rarity as Rarity, player: r.player_name, team: r.team, number: r.card_number, variation: r.variation, rc: r.is_rc, auto: r.is_auto, patch: !!r.is_patch, run: r.print_run ?? null,
  img: r.image_url, set: r.set_name, year: r.set_year, brand: r.set_brand, sport: r.sport, credit: r.credit_user ? credits[r.credit_user] || null : null,
})

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'packs-get', 120, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const view = req.nextUrl.searchParams.get('view') || 'state'
  if (view === 'inventory') {
    const { data, error } = await admin.rpc('pack_inventory', { p_user: user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 503 })
    const rows = (data || []) as { credit: string | null }[]
    const credits = await creditNames(rows.map(r => r.credit))
    return NextResponse.json({ cards: rows.map(r => ({ ...r, credit: r.credit ? credits[r.credit] || null : null })) })
  }
  try {
    const [info, stock, st] = await Promise.all([
      poolInfo(),
      admin.rpc('pack_stock', { p_user: user.id, p_use: false, p_max: PACK_MAX }),
      admin.from('user_packs').select('pity, opened').eq('user_id', user.id).maybeSingle(),
    ])
    if (stock.error) throw new Error(stock.error.message)
    const k = stock.data as { stock: number; next: string | null }
    const row = st.data as { pity: number; opened: number } | null
    return NextResponse.json({ stock: k.stock, next: k.next, max: PACK_MAX, canFree: DEV || k.stock >= 1, pity: row?.pity ?? 0, opened: row?.opened ?? 0, info, dev: DEV })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }
}

// Probabilité de chaque rareté pour un emplacement qui exige au moins `min`, limitée aux raretés qui existent dans le pot
function pickRarity(min: Rarity, have: (r: Rarity) => boolean, max: Rarity = 5): Rarity | null {
  const ok = ([1, 2, 3, 4, 5] as Rarity[]).filter(r => r >= min && r <= max && have(r))
  if (!ok.length) {
    for (let r = Math.min(min, max) - 1; r >= 1; r--) if (have(r as Rarity)) return r as Rarity   // plus rien d'aussi rare : la meilleure rareté en dessous
    for (let r = Math.max(min, max) + 1; r <= 5; r++) if (have(r as Rarity)) return r as Rarity   // sinon la plus proche au-dessus
    return null
  }
  const total = ok.reduce((s, r) => s + BASE_ODDS[r], 0)
  let x = randomInt(0, total * 1000) / 1000
  for (const r of ok) { x -= BASE_ODDS[r]; if (x < 0) return r }
  return ok[ok.length - 1]
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'packs-open', 30, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let info: Info
  try { info = await poolInfo() } catch { return NextResponse.json({ error: 'Le jeu n’est pas encore prêt (le pot de cartes est vide).' }, { status: 503 }) }

  const { data: st } = await admin.from('user_packs').select('pity').eq('user_id', user.id).maybeSingle()
  const before = st as { pity: number } | null
  const pity = before?.pity ?? 0

  // 1) on prend un pack dans la réserve, de façon atomique (impossible de dépenser deux fois le même, même avec deux onglets)
  if (!DEV) {
    const { data: got } = await admin.rpc('pack_stock', { p_user: user.id, p_use: true, p_max: PACK_MAX })
    const k = got as { ok: boolean; next: string | null } | null
    if (!k?.ok) return NextResponse.json({ error: 'Plus de pack en réserve : le prochain arrive dans moins d’une heure.', next: k?.next ?? null }, { status: 409 })
  }
  const refund = async () => { if (!DEV) await admin.rpc('pack_refund', { p_user: user.id, p_max: PACK_MAX }) }

  try {
    // 2) emplacements : 1 carte rare garantie ; +1 épique à coup sûr si la garantie « pity » est atteinte
    // emplacements : 1 carte rare garantie, au moins PACK_COMMONS communes (exactement la rareté 1), le reste suit les probabilités normales
    const slots: { min: Rarity; max: Rarity }[] = [{ min: pity >= PITY_LIMIT - 1 ? 4 : PACK_GUARANTEE, max: 5 }]
    for (let i = 0; i < PACK_COMMONS; i++) slots.push({ min: 1, max: 1 })
    while (slots.length < PACK_CARDS) slots.push({ min: 1, max: 5 })

    // 3) tirage : position aléatoire exacte dans la rareté choisie (pas de biais)
    const taken = new Set<number>()
    const players = new Set<string>()   // jamais deux fois le même joueur dans un pack
    const rows: PoolRow[] = []
    let commons = 0
    const usedHigh = new Set<number>()   // au plus 1 rare, 1 épique et 1 légendaire par pack
    for (const m of slots) {
      // au plus PACK_MAX_COMMONS communes : au-delà, les emplacements libres sont tirés parmi les raretés supérieures
      const minR: Rarity = commons >= PACK_MAX_COMMONS && m.max > 1 ? (Math.max(m.min, 2) as Rarity) : m.min
      for (let attempt = 0; attempt < 14; attempt++) {
        const r = pickRarity(minR, x => (info.rarity[String(x)] || 0) > 0 && !(x >= 3 && usedHigh.has(x)), m.max)
        if (r == null) break
        const k = randomInt(0, info.rarity[String(r)] || 1)
        const { data } = await admin.from('pack_pool').select(COLS).eq('rarity', r).order('rid', { ascending: true }).range(k, k)
        const row = (data?.[0] || null) as PoolRow | null
        const pk = row ? row.player_name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
        if (row && !taken.has(row.entry_id) && !players.has(pk)) { taken.add(row.entry_id); players.add(pk); rows.push(row); if (row.rarity === 1) commons++; if (row.rarity >= 3) usedHigh.add(row.rarity); break }
      }
    }
    if (rows.length < 3) throw new Error('pas assez de cartes dans le pot')
    rows.sort((a, b) => a.rarity - b.rarity)   // la meilleure carte sort en dernier

    const best = Math.max(...rows.map(r => r.rarity))
    const newPity = best >= 4 ? 0 : pity + 1
    await admin.rpc('pack_finish', { p_user: user.id, p_pity: newPity })
    await admin.rpc('pack_record', { p_user: user.id, p_ids: rows.map(r => r.entry_id) })   // historique (si la fonction n'existe pas encore, on ignore)
    const credits = await creditNames(rows.map(r => r.credit_user))
    return NextResponse.json({ cards: rows.map(r => toCard(r, credits)), pity: newPity, pityHit: pity >= PITY_LIMIT - 1 && best >= 4 })
  } catch (e) {
    await refund()
    return NextResponse.json({ error: 'Le tirage a échoué, ton pack t’est rendu. ' + (e as Error).message }, { status: 500 })
  }
}
