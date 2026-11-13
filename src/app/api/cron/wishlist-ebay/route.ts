import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { sendPushToUser } from '@/lib/pushNotify'
import { wishlistEbayFoundPush, normalizePushLang } from '@/lib/pushTranslations'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { fmtPrice } from '@/lib/marketplace'
import { usdToEurRate } from '@/lib/playerCardMarket'
import { demoUserIds } from '@/lib/demoUsers'

export const maxDuration = 120

const supabase = createServerServiceClient()
const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const MAX_WISHES = 60 // quota eBay partagé (5 000 requêtes/jour) : une requête par carte surveillée, plafonnée
const GRADED = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded']

// Quotidien : pour chaque carte de wishlist AVEC prix cible, cherche des annonces eBay (prix fixe / offre) à ce prix ou moins et prévient le membre
// (une alerte par annonce, jamais deux fois la même annonce en 14 jours). Vinted n'a pas d'API publique : non couvert ici.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const appId = process.env.EBAY_APP_ID, certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ error: 'identifiants eBay manquants' }, { status: 500 })

  const { data: targets } = await supabase.from('wishlist_prix_cible').select('wishlist_id, user_id, prix').limit(500)
  if (!targets?.length) return NextResponse.json({ ok: true, checked: 0, notified: 0 })
  const { data: wl } = await supabase.from('wishlist').select('id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch').in('id', targets.map(t => t.wishlist_id))
  const demo = await demoUserIds(supabase)
  const wishes = (wl || []).filter(w => w.nom && !demo.has(w.user_id)).slice(0, MAX_WISHES)
  if (!wishes.length) return NextResponse.json({ ok: true, checked: 0, notified: 0 })
  const targetOf = new Map(targets.map(t => [t.wishlist_id as string, Number(t.prix)]))

  const tokRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    cache: 'no-store',
  })
  const token = (await tokRes.json().catch(() => ({})))?.access_token as string | undefined
  if (!token) return NextResponse.json({ error: 'jeton eBay refusé' }, { status: 502 })
  const rate = await usdToEurRate()

  let checked = 0, notified = 0
  for (const w of wishes) {
    const target = targetOf.get(w.id)
    if (!target) continue
    const num = String(w.num || '').match(/\/(\d+)/)?.[1]
    const q = [w.nom, String(w.annee || '').slice(0, 4), w.collection, w.variation, num ? `/${num}` : '', w.rc ? 'RC' : '', w.auto ? 'auto' : '', w.patch ? 'patch' : ''].filter(Boolean).join(' ')
    // seuil en dollars (eBay US) avec 5 % de marge ; le prix exact est recomparé en euros ci-dessous
    const maxUsd = Math.ceil((target / rate) * 1.05)
    const filter = `buyingOptions:{FIXED_PRICE|BEST_OFFER},price:[1..${maxUsd}],priceCurrency:USD`
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=30&sort=price&filter=${encodeURIComponent(filter)}`
    let items: any[] = []
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=FR' }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
      checked++
      if (r.ok) items = (await r.json())?.itemSummaries || []
    } catch { continue }

    const must = [w.nom, String(w.annee || '').slice(0, 4), w.collection].filter(Boolean).map(normalize)
    const hit = items.map(i => {
      const sc = i.shippingOptions?.[0]?.shippingCost
      return {
        title: String(i.title || ''), url: String(i.itemWebUrl || ''), img: String(i.image?.imageUrl || i.thumbnailImages?.[0]?.imageUrl || ''),
        eur: parseFloat(i.price?.value || '0') * (i.price?.currency === 'EUR' ? 1 : rate),
        ship: sc?.value !== undefined ? parseFloat(sc.value) * (sc.currency === 'EUR' ? 1 : rate) : 0, // port inconnu : non compté
      }
    }).filter(i => i.url && i.eur > 0 && i.eur + i.ship <= target)
      .filter(i => {
        const t = normalize(i.title)
        // la wishlist ne précise pas de note : les cartes gradées (prix non comparable) sont écartées
        return must.every(m => t.includes(m)) && !GRADED.some(g => t.includes(g)) && (!w.auto || t.includes('auto')) && (!w.rc || t.includes('rc') || t.includes('rookie'))
      })
      .sort((a, b) => (a.eur + a.ship) - (b.eur + b.ship))[0]
    if (!hit) continue

    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data: dup } = await supabase.from('notifications').select('id').eq('user_id', w.user_id).eq('type', 'wishlist_ebay').eq('lien', hit.url).gte('created_at', since).limit(1)
    if (dup?.length) continue
    const { data: prof } = await supabase.from('profiles').select('preferred_lang').eq('id', w.user_id).maybeSingle()
    const lang = normalizePushLang(prof?.preferred_lang)
    const { title, body } = wishlistEbayFoundPush(lang, w.nom, fmtPrice(Math.round((hit.eur + hit.ship) * 100) / 100), fmtPrice(target))
    await Promise.all([
      supabase.from('notifications').insert({ user_id: w.user_id, type: 'wishlist_ebay', message: body, lien: hit.url, lu: false }),
      sendPushToUser(w.user_id, { title, body, url: hit.url, channelId: 'wishlist', imageUrl: hit.img || undefined }),
    ])
    notified++
  }
  return NextResponse.json({ ok: true, checked, notified })
}
