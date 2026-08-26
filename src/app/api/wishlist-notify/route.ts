import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { wishlistMatchFoundPush, wishlistCardAddedPush, genericCollectorName, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// normalize() supprimait purement les caractères accentués au lieu de les
// translittérer ("François" → "franois"), ratant de vrais matches et pouvant
// en créer de faux entre deux noms différents qui perdent leur seule lettre
// distinctive. NFD + suppression des diacritiques (U+0300-036f) règle les deux.
const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: string) => { const m = (s || '').match(/\/(\d+)/); return m ? m[1] : normalize(s) }
// Échappe les métacaractères ILIKE (% et _) — sans ça, un nom contenant l'un
// de ces caractères transforme la recherche ciblée en scan de table complet
// (répétable à volonté, sans coût pour l'appelant).
const escapeLike = (s: string) => (s || '').replace(/[%_]/g, c => `\\${c}`)

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

  // Vérifie que wishItem correspond réellement à une ligne de la wishlist de
  // l'appelant — sans ça, n'importe quel utilisateur connecté pouvait poster
  // un item entièrement inventé (jamais sauvegardé) pour spammer jusqu'à 10
  // autres utilisateurs de fausses notifs "quelqu'un cherche votre carte",
  // en boucle, sans aucune limite de fréquence.
  const { data: realWish } = await supabase
    .from('wishlist').select('id').eq('user_id', wishUserId).ilike('nom', escapeLike(wishItem.nom)).limit(1).maybeSingle()
  if (!realWish) return NextResponse.json({ ok: false })

  // Filtrer par nom en SQL pour éviter un scan complet
  const { data: cards } = await supabase
    .from('cartes_manuelles')
    .select('user_id, nom, annee, marque, collection, image_recto')
    .neq('user_id', wishUserId)
    .ilike('nom', escapeLike(wishItem.nom))

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

  // Anti-spam : ne pas re-notifier quelqu'un déjà prévenu pour cette même
  // wishlist récemment — sans ça, ajouter plusieurs exemplaires physiques de
  // la même carte matchée (PUT, un appel par carte) redéclenchait une notif
  // "quelqu'un cherche votre carte" à chaque fois, indéfiniment.
  const wishLien = `/galerie/${wishUserId}?tab=wishlist`
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recentlyNotified } = toNotify.length
    ? await supabase.from('notifications').select('user_id').eq('type', 'wishlist_match').eq('lien', wishLien).in('user_id', toNotify).gte('created_at', sevenDaysAgo)
    : { data: [] }
  const alreadyNotified = new Set((recentlyNotified || []).map(n => n.user_id))
  const finalNotify = toNotify.filter(uid => !alreadyNotified.has(uid))

  const { data: recipientProfiles } = await supabase
    .from('profiles').select('id, preferred_lang').in('id', finalNotify)
  const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all(finalNotify.map(async uid => {
    const lang = langMap.get(uid) ?? 'fr'
    const ownerName = wishUser?.display_name || genericCollectorName(lang)
    const { title, body } = wishlistMatchFoundPush(lang, ownerName, wishItem.nom, wishItem.annee)
    const matchedCard = (cards || []).find(c => c.user_id === uid)
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'wishlist_match', message: body, lien: wishLien, lu: false }),
      sendPushToUser(uid, { title, body, url: wishLien, channelId: 'wishlist', imageUrl: matchedCard?.image_recto || undefined }),
    ])
  }))

  return NextResponse.json({ ok: true, notified: finalNotify.length })
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
    .ilike('nom', escapeLike(card.nom))

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

  // Anti-spam (voir le même mécanisme dans POST ci-dessus) — clé volontairement
  // large (par galerie, pas par carte précise) : simple à vérifier avant
  // d'envoyer, au prix de pouvoir masquer une 2e carte différente ajoutée à la
  // même galerie dans les 7 jours, un compromis raisonnable face au spam.
  const cardLien = `/galerie/${cardUserId}`
  const sevenDaysAgoPut = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recentlyNotifiedPut } = toNotify.length
    ? await supabase.from('notifications').select('user_id').eq('type', 'wishlist_match').eq('lien', cardLien).in('user_id', toNotify).gte('created_at', sevenDaysAgoPut)
    : { data: [] }
  const alreadyNotifiedPut = new Set((recentlyNotifiedPut || []).map(n => n.user_id))
  const finalNotifyPut = toNotify.filter(uid => !alreadyNotifiedPut.has(uid))

  const { data: recipientProfiles } = await supabase
    .from('profiles').select('id, preferred_lang').in('id', finalNotifyPut)
  const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all(finalNotifyPut.map(async uid => {
    const lang = langMap.get(uid) ?? 'fr'
    const ownerName = cardUser?.display_name || genericCollectorName(lang)
    const { title, body } = wishlistCardAddedPush(lang, ownerName, card.nom, card.annee)
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'wishlist_match', message: body, lien: cardLien, lu: false }),
      sendPushToUser(uid, { title, body, url: cardLien, channelId: 'wishlist', imageUrl: card.image_recto || undefined }),
    ])
  }))

  return NextResponse.json({ ok: true, notified: finalNotifyPut.length })
}
