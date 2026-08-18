import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { wishlistMatchFoundPush, wishlistCardAddedPush, genericCollectorName, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: string) => { const m = (s || '').match(/\/(\d+)/); return m ? m[1] : normalize(s) }

function cardMatchesWish(card: any, wish: any) {
  if (normalize(card.nom) !== normalize(wish.nom)) return false
  if (wish.annee && normalize(card.annee) !== normalize(wish.annee)) return false
  if (wish.marque && normalize(card.marque) !== normalize(wish.marque)) return false
  if (wish.collection && normalize(card.collection) !== normalize(wish.collection)) return false
  if (wish.variation && normalize(card.variation) !== normalize(wish.variation)) return false
  if (wish.num && normNum(card.num) !== normNum(wish.num)) return false
  if (wish.rc != null && wish.rc && !card.rc) return false
  if (wish.auto != null && wish.auto && !card.auto) return false
  if (wish.patch != null && wish.patch && !card.patch) return false
  return true
}

async function verifyToken(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

// Appelé quand un user ajoute une carte à sa wishlist → notifier les possesseurs
export async function POST(req: NextRequest) {
  const callerId = await verifyToken(req)
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wishItem, wishUserId } = await req.json()
  if (!wishItem || !wishUserId) return NextResponse.json({ ok: false })
  if (callerId !== wishUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Filtrer par nom en SQL pour éviter un scan complet
  const { data: cards } = await supabase
    .from('cartes_manuelles')
    .select('user_id, nom, annee, marque, collection, image_recto')
    .neq('user_id', wishUserId)
    .ilike('nom', wishItem.nom)

  const { data: wishUser } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', wishUserId)
    .single()

  const MAX_NOTIFS = 10
  const toNotify: string[] = []
  for (const card of cards || []) {
    if (toNotify.length >= MAX_NOTIFS) break
    if (!toNotify.includes(card.user_id) && cardMatchesWish(card, wishItem)) {
      toNotify.push(card.user_id)
    }
  }

  const { data: recipientProfiles } = await supabase
    .from('profiles').select('id, preferred_lang').in('id', toNotify)
  const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all(toNotify.map(async uid => {
    const lang = langMap.get(uid) ?? 'fr'
    const ownerName = wishUser?.display_name || genericCollectorName(lang)
    const { title, body } = wishlistMatchFoundPush(lang, ownerName, wishItem.nom, wishItem.annee)
    const matchedCard = (cards || []).find(c => c.user_id === uid)
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'wishlist_match', message: body, lien: `/galerie/${wishUserId}?tab=wishlist`, lu: false }),
      sendPushToUser(uid, { title, body, url: `/galerie/${wishUserId}?tab=wishlist`, channelId: 'wishlist', imageUrl: matchedCard?.image_recto || undefined }),
    ])
  }))

  return NextResponse.json({ ok: true, notified: toNotify.length })
}

// Appelé quand un user ajoute une carte manuelle → notifier les wishlisteurs
export async function PUT(req: NextRequest) {
  const callerId = await verifyToken(req)
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { card, cardUserId } = await req.json()
  if (!card || !cardUserId) return NextResponse.json({ ok: false })
  if (callerId !== cardUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Filtrer les wishlists par nom en SQL pour éviter un scan complet
  const { data: wishes } = await supabase
    .from('wishlist')
    .select('*')
    .neq('user_id', cardUserId)
    .ilike('nom', card.nom)

  const { data: cardUser } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', cardUserId)
    .single()

  const MAX_NOTIFS = 10
  const toNotify: string[] = []
  for (const wish of wishes || []) {
    if (toNotify.length >= MAX_NOTIFS) break
    if (!toNotify.includes(wish.user_id) && cardMatchesWish(card, wish)) {
      toNotify.push(wish.user_id)
    }
  }

  const { data: recipientProfiles } = await supabase
    .from('profiles').select('id, preferred_lang').in('id', toNotify)
  const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all(toNotify.map(async uid => {
    const lang = langMap.get(uid) ?? 'fr'
    const ownerName = cardUser?.display_name || genericCollectorName(lang)
    const { title, body } = wishlistCardAddedPush(lang, ownerName, card.nom, card.annee)
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'wishlist_match', message: body, lien: `/galerie/${cardUserId}`, lu: false }),
      sendPushToUser(uid, { title, body, url: `/galerie/${cardUserId}`, channelId: 'wishlist', imageUrl: card.image_recto || undefined }),
    ])
  }))

  return NextResponse.json({ ok: true, notified: toNotify.length })
}
