import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'
import { TRADE_SPORTS, isWeekendBonus, PACK_EVERY_MIN_WEEKEND, PACK_EVERY_MIN, DUPES_PER_PACK, MIN_SPORT_POOL, BASE_ODDS, PACK_CARDS, PACK_COMMONS, PACK_GUARANTEE, PACK_MAX_COMMONS, PACK_MAX, PITY_LIMIT, type PackCard, type Rarity } from '@/lib/packs'

export const maxDuration = 30
const admin = createServerServiceClient()

const COLS = 'entry_id, set_id, player_name, team, card_number, variation, is_rc, is_auto, image_url, set_name, set_year, set_brand, sport, credit_user, rarity, is_patch, print_run'
type PoolRow = { entry_id: number; set_id: number; player_name: string; team: string | null; card_number: string | null; variation: string | null; is_rc: boolean; is_auto: boolean; image_url: string; set_name: string | null; set_year: number | null; set_brand: string | null; sport: string | null; credit_user: string | null; rarity: number; is_patch?: boolean; print_run?: number | null }
type Info = { total: number; rarity: Record<string, number>; bySport?: Record<string, Record<string, number>> }
// tant que la migration à jour n'est pas lancée, pack_stock n'accepte pas la cadence : on retombe sur l'ancienne signature
async function stockRpc(user: string, use: boolean) {
  const r = await admin.rpc('pack_stock', { p_user: user, p_use: use, p_max: PACK_MAX, p_every: everyMin() })
  if (r.error) return admin.rpc('pack_stock', { p_user: user, p_use: use, p_max: PACK_MAX })
  return r
}
const everyMin = () => (isWeekendBonus() ? PACK_EVERY_MIN_WEEKEND : PACK_EVERY_MIN)

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
    // Supabase plafonne chaque réponse à 1000 lignes : on lit l'inventaire par pages de 1000
    const rows: { credit: string | null }[] = []
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await admin.rpc('pack_inventory', { p_user: user.id }).range(from, from + 999)
      if (error) return NextResponse.json({ error: error.message }, { status: 503 })
      const page = (data || []) as { credit: string | null }[]
      rows.push(...page)
      if (page.length < 1000) break
    }
    const credits = await creditNames(rows.map(r => r.credit))
    return NextResponse.json({ cards: rows.map(r => ({ ...r, credit: r.credit ? credits[r.credit] || null : null })) })
  }
  try {
    const [info, stock, st, bon, dup] = await Promise.all([
      poolInfo(),
      stockRpc(user.id, false),
      admin.from('user_packs').select('pity, opened').eq('user_id', user.id).maybeSingle(),
      admin.from('user_bonus_packs').select('sport, qty').eq('user_id', user.id).gt('qty', 0),
      admin.rpc('pack_dupes', { p_user: user.id }),
    ])
    if (stock.error) throw new Error(stock.error.message)
    const k = stock.data as { stock: number; next: string | null }
    const row = st.data as { pity: number; opened: number } | null
    return NextResponse.json({ stock: k.stock, next: k.next, max: PACK_MAX, canFree: DEV || k.stock >= 1, pity: row?.pity ?? 0, opened: row?.opened ?? 0, info, dev: DEV,
      bonus: Object.fromEntries((bon.data || []).map(b => [b.sport as string, b.qty as number])), dupes: typeof dup.data === 'number' ? dup.data : 0, dupesPerPack: DUPES_PER_PACK,
      sports: TRADE_SPORTS.map(sp => [sp, Object.values(info.bySport?.[sp] || {}).reduce((x, y) => x + y, 0)] as [string, number]),
      weekend: isWeekendBonus(), everyMin: everyMin() })
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

  const body = await req.json().catch(() => ({})) as { action?: string; sport?: string; bonus?: string }
  // échange de doublons contre un pack bonus (par thème)
  if (body.action === 'trade') {
    const sp = String(body.sport || 'any')
    if (sp !== 'any') { try { const inf = await poolInfo(); const n = Object.values(inf.bySport?.[sp] || {}).reduce((x, y) => x + y, 0); if (n < MIN_SPORT_POOL) return NextResponse.json({ error: 'Ce thème n’est pas encore disponible.' }, { status: 400 }) } catch { return NextResponse.json({ error: 'Indisponible' }, { status: 503 }) } }
    const { data } = await admin.rpc('pack_trade_dupes', { p_user: user.id, p_sport: sp, p_cost: DUPES_PER_PACK })
    if (!(data as { ok?: boolean } | null)?.ok) return NextResponse.json({ error: `Il te faut ${DUPES_PER_PACK} doublons.` }, { status: 409 })
    return NextResponse.json({ ok: true })
  }
  const bonusSport = body.bonus ? String(body.bonus) : ''

  let info: Info
  try { info = await poolInfo() } catch { return NextResponse.json({ error: 'Le jeu n’est pas encore prêt (le pot de cartes est vide).' }, { status: 503 }) }

  const { data: st } = await admin.from('user_packs').select('pity').eq('user_id', user.id).maybeSingle()
  const before = st as { pity: number } | null
  const pity = before?.pity ?? 0

  // 1) on prend un pack : un pack bonus (doublons) si demandé, sinon dans la réserve, de façon atomique (impossible de dépenser deux fois le même, même avec deux onglets)
  const sportFilter = bonusSport && bonusSport !== 'any' ? bonusSport : ''
  if (bonusSport) {
    const { data: okb } = await admin.rpc('pack_bonus_use', { p_user: user.id, p_sport: bonusSport, p_delta: -1 })
    if (!okb) return NextResponse.json({ error: 'Plus de pack bonus de ce thème.' }, { status: 409 })
  } else if (!DEV) {
    const { data: got } = await stockRpc(user.id, true)
    const k = got as { ok: boolean; next: string | null } | null
    if (!k?.ok) return NextResponse.json({ error: 'Plus de pack en réserve : le prochain arrive bientôt.', next: k?.next ?? null }, { status: 409 })
  }
  const refund = async () => { if (bonusSport) await admin.rpc('pack_bonus_use', { p_user: user.id, p_sport: bonusSport, p_delta: 1 }); else if (!DEV) await admin.rpc('pack_refund', { p_user: user.id, p_max: PACK_MAX }) }
  const rcount: Record<string, number> = sportFilter ? (info.bySport?.[sportFilter] || {}) : info.rarity

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
    // cartes déjà possédées : on les évite le plus souvent (il peut y en avoir, mais moins)
    const ownedSet = new Set<number>()
    for (let from = 0; from < 20000; from += 1000) {   // pages de 1000 (plafond Supabase)
      const { data: own } = await admin.from('user_pack_cards').select('entry_id').eq('user_id', user.id).order('entry_id').range(from, from + 999)
      for (const o of own || []) ownedSet.add(o.entry_id as number)
      if ((own?.length || 0) < 1000) break
    }
    const usedHigh = new Set<number>()   // au plus 1 rare, 1 épique et 1 légendaire par pack
    for (const m of slots) {
      // au plus PACK_MAX_COMMONS communes : au-delà, les emplacements libres sont tirés parmi les raretés supérieures
      const minR: Rarity = commons >= PACK_MAX_COMMONS && m.max > 1 ? (Math.max(m.min, 2) as Rarity) : m.min
      for (let attempt = 0; attempt < 14; attempt++) {
        const r = pickRarity(minR, x => (rcount[String(x)] || 0) > 0 && !(x >= 3 && usedHigh.has(x)), m.max)
        if (r == null) break
        const k = randomInt(0, rcount[String(r)] || 1)
        const build = (withDup: boolean) => { let q = admin.from('pack_pool').select(COLS).eq('rarity', r); if (withDup) q = q.is('dup_of', null); if (sportFilter) q = q.eq('sport', sportFilter); return q.order('rid', { ascending: true }).range(k, k) }
        let res = await build(true)
        if (res.error) res = await build(false)   // migration pas encore lancée (colonne dup_of absente)
        const data = res.data
        const row = (data?.[0] || null) as PoolRow | null
        const pk = row ? row.player_name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
        if (row && ownedSet.has(row.entry_id) && attempt < 9 && randomInt(0, 100) < 80) continue   // déjà possédée : on retire, 4 fois sur 5
        if (row && !taken.has(row.entry_id) && !players.has(pk)) { taken.add(row.entry_id); players.add(pk); rows.push(row); if (row.rarity === 1) commons++; if (row.rarity >= 3) usedHigh.add(row.rarity); break }
      }
    }
    if (rows.length < 3) throw new Error('pas assez de cartes dans le pot')
    rows.sort((a, b) => a.rarity - b.rarity)   // la meilleure carte sort en dernier

    const best = Math.max(...rows.map(r => r.rarity))
    const newPity = best >= 4 ? 0 : pity + 1
    await admin.rpc('pack_finish', { p_user: user.id, p_pity: newPity })
    const { data: had } = await admin.from('user_pack_cards').select('entry_id, qty').eq('user_id', user.id).in('entry_id', rows.map(r => r.entry_id))
    const hadMap = new Map((had || []).map(h => [h.entry_id as number, h.qty as number]))
    const rec = await admin.rpc('pack_record', { p_user: user.id, p_ids: rows.map(r => r.entry_id) })
    if (rec.error) console.error('[packs] enregistrement du tirage impossible (relancer 20261203_packs.sql) :', rec.error.message)
    const credits = await creditNames(rows.map(r => r.credit_user))
    return NextResponse.json({ cards: rows.map(r => ({ ...toCard(r, credits), isNew: !hadMap.has(r.entry_id), owned: hadMap.get(r.entry_id) || 0 })), pity: newPity, pityHit: pity >= PITY_LIMIT - 1 && best >= 4 })
  } catch (e) {
    await refund()
    return NextResponse.json({ error: 'Le tirage a échoué, ton pack t’est rendu. ' + (e as Error).message }, { status: 500 })
  }
}
