import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const maxDuration = 20

// Cache par hash d'image exacte -- deux scans de la meme photo (retry,
// reload, deux users qui scannent la meme carte le meme jour via le meme
// screenshot partage) reutilisent le resultat au lieu de repayer l'appel
// image search eBay (le plus couteux du flux de scan).
const RESP_CACHE = new Map<string, { data: object; exp: number }>()
const RESP_TTL   = 4 * 60 * 60 * 1000
function respCacheGet(k: string) {
  const e = RESP_CACHE.get(k)
  if (!e || Date.now() > e.exp) { RESP_CACHE.delete(k); return null }
  return e.data
}
function respCacheSet(k: string, data: object) {
  RESP_CACHE.set(k, { data, exp: Date.now() + RESP_TTL })
}
const SB_TTL_H = 24
async function sbGet(k: string): Promise<object | null> {
  try {
    const { data } = await supabase.from('ebay_cache').select('data').eq('key', k).gt('expires_at', new Date().toISOString()).maybeSingle()
    return (data as any)?.data ?? null
  } catch { return null }
}
async function sbSet(k: string, data: object) {
  try {
    await supabase.from('ebay_cache').upsert({ key: k, data, expires_at: new Date(Date.now() + SB_TTL_H * 3600_000).toISOString() } as any, { onConflict: 'key' })
  } catch { /* non-fatal */ }
}

// Rate limit: 30 req/min par utilisateur -- meme cadence que ebay-sold, qui
// protege deja le quota eBay partage (5 000/jour) ; cette route en etait
// depourvue alors qu'elle consomme le meme quota.
const RATE_MAP = new Map<string, { count: number; reset: number }>()
function checkRate(key: string): boolean {
  const now = Date.now()
  const e = RATE_MAP.get(key)
  if (!e || now > e.reset) { RATE_MAP.set(key, { count: 1, reset: now + 60_000 }); return true }
  if (e.count >= 30) return false
  e.count++; return true
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let tokenCache: { token: string; expires: number } | null = null

async function getOAuthToken(appId: string, certId: string): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token
  try {
    const creds = Buffer.from(`${appId}:${certId}`).toString('base64')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      cache: 'no-store',
    })
    const data = await res.json()
    if (data.access_token) {
      tokenCache = { token: data.access_token, expires: Date.now() + ((data.expires_in || 7200) - 120) * 1000 }
    }
    return data.access_token || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!checkRate(user.id)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ items: [] })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ items: [] })

    const cacheKey = `imgsearch:${createHash('sha256').update(imageBase64).digest('hex')}`
    const memHit = respCacheGet(cacheKey)
    if (memHit) return NextResponse.json(memHit)
    const sbHit = await sbGet(cacheKey)
    if (sbHit) { respCacheSet(cacheKey, sbHit); return NextResponse.json(sbHit) }

    const oauthToken = await getOAuthToken(appId, certId)
    if (!oauthToken) return NextResponse.json({ items: [] })

    const res = await fetch(
      'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image?limit=20&filter=buyingOptions:{FIXED_PRICE|BEST_OFFER}',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageBase64 }),
        signal: AbortSignal.timeout(12000),
        cache: 'no-store',
      }
    )

    if (!res.ok) return NextResponse.json({ items: [] })

    const data = await res.json()
    const items = (data.itemSummaries || [])
      .map((item: any) => ({
        id: item.itemId || '',
        title: item.title || '',
        price: parseFloat(item.price?.value || '0'),
        img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
        url: item.itemWebUrl || '',
      }))
      .filter((i: any) => i.price > 0 && i.img)

    const payload = { items }
    if (items.length > 0) {
      respCacheSet(cacheKey, payload)
      sbSet(cacheKey, payload)  // fire-and-forget
    }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ items: [] })
  }
}
