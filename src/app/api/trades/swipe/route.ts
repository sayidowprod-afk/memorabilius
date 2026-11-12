import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

export const maxDuration = 20

const supabase = createServerServiceClient()
const PAGE = 30       // cartes lues par tour
const WANT = 12       // on relit jusqu'à avoir au moins ce nombre de cartes neuves (ou la fin de la liste)
const COLS = 'id, user_id, nom, equipe, annee, marque, collection, variation, image_recto, rc, auto, patch, num, grade, vendue, reservee, jeu'

async function authed(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}
const clean = (v: string | null) => (v || '').replace(/[,()%*\\"']/g, ' ').trim().slice(0, 60)

// GET /api/trades/swipe?offset=0&team=&player=&collection=&year=&rc=1&auto=1&patch=1
// Cartes « à échanger » des AUTRES membres, que je n'ai pas encore vues, filtrées. `offset` est le curseur de lecture (renvoyé en `next`).
export async function GET(req: NextRequest) {
  const user = await authed(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'trade-swipe-get', 120, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const sp = req.nextUrl.searchParams
  let offset = Math.max(0, parseInt(sp.get('offset') || '0') || 0)
  const team = clean(sp.get('team')), player = clean(sp.get('player')), collection = clean(sp.get('collection')), year = clean(sp.get('year'))

  const out: any[] = []
  let exhausted = false
  // on lit par tours (les cartes déjà vues sont retirées ensuite) jusqu'à avoir de quoi remplir un lot, avec un plafond pour ne pas boucler
  for (let round = 0; round < 6 && out.length < WANT && !exhausted; round++) {
    let q = supabase.from('cartes_manuelles').select(COLS).eq('disponible_vente', true).neq('user_id', user.id).not('image_recto', 'is', null)
    if (team) q = q.ilike('equipe', `%${team}%`)
    if (player) q = q.ilike('nom', `%${player}%`)
    if (collection) q = q.ilike('collection', `%${collection}%`)
    if (year) q = q.ilike('annee', `%${year}%`)
    if (sp.get('rc') === '1') q = q.eq('rc', true)
    if (sp.get('auto') === '1') q = q.eq('auto', true)
    if (sp.get('patch') === '1') q = q.eq('patch', true)
    const { data: rows, error } = await q.order('created_at', { ascending: false }).order('id').range(offset, offset + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    offset += rows?.length || 0
    if (!rows || rows.length < PAGE) exhausted = true
    const cands = (rows || []).filter(r => !r.vendue && !r.reservee)
    if (!cands.length) continue
    const { data: seen } = await supabase.from('trade_swipes').select('card_id').eq('user_id', user.id).in('card_id', cands.map(c => c.id))
    const seenSet = new Set((seen || []).map(s => s.card_id))
    for (const c of cands) if (!seenSet.has(c.id)) out.push(c)
  }

  const ownerIds = [...new Set(out.map(c => c.user_id))]
  const { data: profs } = ownerIds.length ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ownerIds) : { data: [] as any[] }
  const byId = new Map((profs || []).map((p: any) => [p.id, p]))
  const cards = out.map(c => ({ ...c, owner_name: byId.get(c.user_id)?.display_name || 'Un collectionneur', owner_avatar: byId.get(c.user_id)?.avatar_url || null }))
  return NextResponse.json({ cards, next: offset, done: exhausted && cards.length === 0 })
}

// POST /api/trades/swipe { cardId, like } : enregistre mon choix. Si j'aime une carte et que son propriétaire a aimé une des miennes : « match ».
export async function POST(req: NextRequest) {
  const user = await authed(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'trade-swipe-post', 240, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const cardId = String(body?.cardId || ''), like = !!body?.like
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return NextResponse.json({ error: 'Carte invalide' }, { status: 400 })

  const { data: card } = await supabase.from('cartes_manuelles').select('id, user_id, nom, image_recto').eq('id', cardId).single()
  if (!card || card.user_id === user.id) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
  const { error } = await supabase.from('trade_swipes').upsert({ user_id: user.id, card_id: cardId, owner_id: card.user_id, liked: like }, { onConflict: 'user_id,card_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!like) return NextResponse.json({ ok: true, match: false })

  // le propriétaire a-t-il aimé une de mes cartes (encore disponible) ?
  const { data: theirLikes } = await supabase.from('trade_swipes').select('card_id').eq('user_id', card.user_id).eq('owner_id', user.id).eq('liked', true).limit(20)
  const ids = (theirLikes || []).map(l => l.card_id)
  if (!ids.length) return NextResponse.json({ ok: true, match: false })
  const { data: mine } = await supabase.from('cartes_manuelles').select('id, nom, annee, collection, image_recto, vendue, reservee, disponible_vente').in('id', ids).eq('user_id', user.id)
  const mineOk = (mine || []).find(m => m.disponible_vente && !m.vendue && !m.reservee)
  if (!mineOk) return NextResponse.json({ ok: true, match: false })

  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  await supabase.from('notifications').insert({
    user_id: card.user_id, type: 'trade_match',
    message: `Match d’échange avec ${me?.display_name || 'un collectionneur'} : vous avez chacun aimé une carte de l’autre !`,
    lien: '/trades?tab=swipe', lu: false,
  })
  const { data: owner } = await supabase.from('profiles').select('display_name').eq('id', card.user_id).single()
  return NextResponse.json({
    ok: true, match: true,
    other: { id: card.user_id, name: owner?.display_name || 'Un collectionneur' },
    theirCard: { id: card.id, nom: card.nom, image: card.image_recto },
    myCard: { id: mineOk.id, nom: mineOk.nom, image: mineOk.image_recto },
  })
}
