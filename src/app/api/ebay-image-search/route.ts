import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getOAuthToken(appId: string, certId: string): Promise<string | null> {
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

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ items: [] })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ items: [] })

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

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
