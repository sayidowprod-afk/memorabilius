import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/pushNotify'
import { wishlistPriceFoundPush, genericCollectorName, normalizePushLang } from '@/lib/pushTranslations'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { fmtPrice } from '@/lib/marketplace'

const supabase = createServerServiceClient()

const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: string) => { const m = (s || '').match(/\/(\d+)/); return m ? m[1] : normalize(s) }
const escapeLike = (s: string) => (s || '').replace(/[%_]/g, c => `\\${c}`)

// Même règle de correspondance que /api/wishlist-notify : tous les champs renseignés dans la wishlist doivent coïncider.
function matches(card: Record<string, unknown>, wish: Record<string, unknown>) {
  const f = (k: string) => String(card[k] ?? '')
  const w = (k: string) => String(wish[k] ?? '')
  if (normalize(f('nom')) !== normalize(w('nom'))) return false
  if (w('annee') && normalize(f('annee')) !== normalize(w('annee'))) return false
  if (w('marque') && normalize(f('marque')) !== normalize(w('marque'))) return false
  if (w('collection') && normalize(f('collection')) !== normalize(w('collection'))) return false
  if (w('variation') && normalize(f('variation')) !== normalize(w('variation'))) return false
  if (w('num') && normNum(f('num')) !== normNum(w('num'))) return false
  if (wish.rc && !card.rc) return false
  if (wish.auto && !card.auto) return false
  if (wish.patch && !card.patch) return false
  return true
}

// Appelé quand un membre met un prix sur une de ses cartes à vendre : prévient les membres dont la wishlist contient cette carte
// avec un prix cible supérieur ou égal à ce prix. La carte est relue en base (le prix annoncé par l'appelant n'est pas cru sur parole).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await req.json().catch(() => ({})) as { cardId?: string }
  if (!cardId) return NextResponse.json({ ok: false })

  const { data: card } = await supabase.from('cartes_manuelles').select('*').eq('id', cardId).eq('user_id', user.id).maybeSingle()
  if (!card || !card.disponible_vente || card.vendue || card.prix_vente == null) return NextResponse.json({ ok: true, notified: 0 })
  const price = Number(card.prix_vente)

  // colonne prix_cible absente (migration non appliquée) : erreur ignorée, simplement personne n'est prévenu
  const { data: wishes, error } = await supabase.from('wishlist').select('*').neq('user_id', user.id).ilike('nom', escapeLike(card.nom)).not('prix_cible', 'is', null).gte('prix_cible', price)
  if (error || !wishes?.length) return NextResponse.json({ ok: true, notified: 0 })

  const lien = `/galerie/${user.id}${card.image_recto ? `?card=${encodeURIComponent(card.image_recto)}` : ''}`
  const toNotify: { uid: string; target: number }[] = []
  for (const w of wishes) {
    if (toNotify.length >= 10) break
    if (!toNotify.some(x => x.uid === w.user_id) && matches(card, w)) toNotify.push({ uid: w.user_id, target: Number(w.prix_cible) })
  }

  // anti-spam : pas deux fois la même alerte pour la même carte en 7 jours (même si le prix est modifié plusieurs fois)
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recent } = toNotify.length
    ? await supabase.from('notifications').select('user_id').eq('type', 'wishlist_match').eq('lien', lien).in('user_id', toNotify.map(x => x.uid)).gte('created_at', since)
    : { data: [] }
  const done = new Set((recent || []).map(n => n.user_id))
  const final = toNotify.filter(x => !done.has(x.uid))
  if (!final.length) return NextResponse.json({ ok: true, notified: 0 })

  const [{ data: seller }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase.from('profiles').select('id, preferred_lang').in('id', final.map(x => x.uid)),
  ])
  const langMap = new Map((profiles || []).map((p: { id: string; preferred_lang: unknown }) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all(final.map(async ({ uid, target }) => {
    const lang = langMap.get(uid) ?? 'fr'
    const { title, body } = wishlistPriceFoundPush(lang, seller?.display_name || genericCollectorName(lang), card.nom, fmtPrice(price), fmtPrice(target))
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'wishlist_match', message: body, lien, lu: false }),
      sendPushToUser(uid, { title, body, url: lien, channelId: 'wishlist', imageUrl: card.image_recto || undefined }),
    ])
  }))
  return NextResponse.json({ ok: true, notified: final.length })
}
