import { NextRequest, NextResponse } from 'next/server'

export interface SalePoint { date: string; price: number; title: string }
export interface CardValueResponse {
  sales: SalePoint[]
  current: number
  min: number
  max: number
  currency: string
  source: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const appId = process.env.EBAY_APP_ID

  // Sans clé eBay → données de démo pour visualiser le module
  if (!appId) {
    const demo = generateDemo(q)
    return NextResponse.json({ ...demo, source: 'demo' })
  }

  try {
    const url = new URL('https://svcs.ebay.com/services/search/FindingService/v1')
    url.searchParams.set('OPERATION-NAME', 'findCompletedItems')
    url.searchParams.set('SERVICE-VERSION', '1.0.0')
    url.searchParams.set('SECURITY-APPNAME', appId)
    url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON')
    url.searchParams.set('keywords', q)
    url.searchParams.set('categoryId', '212') // Sports Trading Cards
    url.searchParams.set('itemFilter(0).name', 'SoldItemsOnly')
    url.searchParams.set('itemFilter(0).value', 'true')
    url.searchParams.set('sortOrder', 'EndTimeSoonest')
    url.searchParams.set('paginationInput.entriesPerPage', '20')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('eBay API error')
    const data = await res.json()

    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
    const sales: SalePoint[] = items
      .filter((item: any) => item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__)
      .map((item: any) => ({
        date: item.listingInfo[0].endTime[0].split('T')[0],
        price: parseFloat(item.sellingStatus[0].currentPrice[0].__value__),
        title: item.title[0],
      }))
      .reverse()

    if (sales.length === 0) return NextResponse.json({ ...generateDemo(q), source: 'demo' })

    const prices = sales.map(s => s.price)
    return NextResponse.json({
      sales,
      current: prices[prices.length - 1],
      min: Math.min(...prices),
      max: Math.max(...prices),
      currency: '€',
      source: 'ebay',
    })
  } catch {
    return NextResponse.json({ ...generateDemo(q), source: 'demo' })
  }
}

function generateDemo(q: string): CardValueResponse {
  // Génère des données réalistes basées sur le hash du nom
  const seed = q.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = 10 + (seed % 80)
  const now = Date.now()
  const sales: SalePoint[] = Array.from({ length: 12 }, (_, i) => {
    const variation = (Math.sin(seed + i * 1.7) * 0.3 + (i / 12) * 0.2) * base
    return {
      date: new Date(now - (11 - i) * 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      price: Math.round((base + variation) * 100) / 100,
      title: q,
    }
  })
  const prices = sales.map(s => s.price)
  return {
    sales,
    current: prices[prices.length - 1],
    min: Math.round(Math.min(...prices) * 100) / 100,
    max: Math.round(Math.max(...prices) * 100) / 100,
    currency: '€',
    source: 'demo',
  }
}
