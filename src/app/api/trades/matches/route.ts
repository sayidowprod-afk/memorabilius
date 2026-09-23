import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Meme logique de matching que api/wishlist-notify (voir ses commentaires) --
// dupliquee ici plutot que partagee car cette route est en lecture seule et
// ne doit pas dependre de la route de notification.
const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: string) => { const m = (s || '').match(/\/(\d+)/); return m ? m[1] : normalize(s) }
const escapeLike = (s: string) => (s || '').replace(/[%_,()]/g, c => (c === '%' || c === '_') ? `\\${c}` : ' ')

function cardMatchesWish(card: any, wish: any) {
  if (normalize(card.nom) !== normalize(wish.nom)) return false
  if (wish.annee && normalize(card.annee) !== normalize(wish.annee)) return false
  if (wish.marque && normalize(card.marque) !== normalize(wish.marque)) return false
  if (wish.collection && normalize(card.collection) !== normalize(wish.collection)) return false
  if (wish.variation && normalize(card.variation) !== normalize(wish.variation)) return false
  if (wish.num && normNum(card.num) !== normNum(wish.num)) return false
  if (wish.rc && !card.rc) return false
  if (wish.auto && !card.auto) return false
  if (wish.patch && !card.patch) return false
  return true
}

const CARD_COLS = 'id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch, image_recto, valeur'

// GET /api/trades/matches -- mise en relation wishlist <-> collection :
//  - iWant     : cartes DISPONIBLES d'autres membres qui correspondent a MA wishlist
//  - theyWant  : MES cartes disponibles qui correspondent a la wishlist d'autres membres
//  - perfect   : membres qui sont dans les deux listes (echange parfait possible)
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: myWishes }, { data: myCards }] = await Promise.all([
    supabase.from('wishlist').select('*').eq('user_id', user.id).limit(60),
    supabase.from('cartes_manuelles').select(CARD_COLS).eq('user_id', user.id).eq('disponible_vente', true).limit(300),
  ])

  // Cartes privees (meme filtre que /api/recherche) : ne jamais montrer a un
  // autre membre une carte que son proprietaire a masquee.
  const isPrivateFor = async (rows: any[]) => {
    const ownerIds = [...new Set(rows.map(r => r.user_id))]
    if (!ownerIds.length) return () => false
    const { data: privees } = await supabase.from('cartes_privees').select('user_id, card_key').in('user_id', ownerIds)
    const set = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
    return (r: any) => set.has(`${r.user_id}::${r.image_recto}`)
  }

  // ── iWant : ma wishlist vs cartes dispo des autres ──────────────────────────
  const iWant: { wish: any; card: any }[] = []
  if (myWishes?.length) {
    const orFilter = myWishes.map(w => `nom.ilike.${escapeLike(w.nom)}`).join(',')
    const { data: candidates } = await supabase
      .from('cartes_manuelles').select(CARD_COLS)
      .neq('user_id', user.id).eq('disponible_vente', true).or(orFilter).limit(600)
    const isPriv = await isPrivateFor(candidates || [])
    for (const card of candidates || []) {
      if (isPriv(card)) continue
      const wish = myWishes.find(w => cardMatchesWish(card, w))
      if (wish) iWant.push({ wish: { id: wish.id, nom: wish.nom }, card })
    }
  }

  // ── theyWant : wishlists des autres vs mes cartes dispo ─────────────────────
  const theyWant: { wisherId: string; wish: any; card: any }[] = []
  if (myCards?.length) {
    const names = [...new Set(myCards.map(c => c.nom).filter(Boolean))].slice(0, 80)
    const orFilter = names.map(n => `nom.ilike.${escapeLike(n)}`).join(',')
    const { data: wishes } = await supabase
      .from('wishlist').select('*').neq('user_id', user.id).or(orFilter).limit(600)
    for (const card of myCards) {
      for (const w of wishes || []) {
        if (cardMatchesWish(card, w)) theyWant.push({ wisherId: w.user_id, wish: { id: w.id, nom: w.nom }, card })
      }
    }
  }

  // ── Profils des membres concernes ───────────────────────────────────────────
  const memberIds = [...new Set([...iWant.map(m => m.card.user_id), ...theyWant.map(m => m.wisherId)])]
  const { data: profiles } = memberIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', memberIds)
    : { data: [] }
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const group = (rows: { memberId: string; item: any }[]) => {
    const by = new Map<string, any[]>()
    for (const r of rows) {
      if (!by.has(r.memberId)) by.set(r.memberId, [])
      by.get(r.memberId)!.push(r.item)
    }
    return by
  }
  const theirCardsByMember = group(iWant.map(m => ({ memberId: m.card.user_id, item: { ...m.card, wishNom: m.wish.nom } })))
  const myCardsByMember = group(theyWant.map(m => ({ memberId: m.wisherId, item: { ...m.card, wishNom: m.wish.nom } })))

  const members = memberIds.map(id => {
    const theirs = theirCardsByMember.get(id) || []
    // Cartes distinctes (une meme carte peut matcher plusieurs wishes)
    const mine = [...new Map((myCardsByMember.get(id) || []).map(c => [c.id, c])).values()]
    return {
      id,
      name: profileMap.get(id)?.display_name || 'Collector',
      avatar: profileMap.get(id)?.avatar_url || null,
      theyHave: [...new Map(theirs.map(c => [c.id, c])).values()],   // ce que CE membre a et que je veux
      theyWantFromMe: mine,                                            // ce que j'ai et que CE membre veut
      perfect: theirs.length > 0 && mine.length > 0,
    }
  }).sort((a, b) => Number(b.perfect) - Number(a.perfect) || (b.theyHave.length + b.theyWantFromMe.length) - (a.theyHave.length + a.theyWantFromMe.length))

  return NextResponse.json({
    members,
    counts: {
      total: members.length,
      perfect: members.filter(m => m.perfect).length,
    },
  })
}
