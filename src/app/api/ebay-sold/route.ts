import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const keywords = searchParams.get('q')
  if (!keywords) return NextResponse.json({ items: [] })

  const appId = process.env.EBAY_APP_ID
  if (!appId) return NextResponse.json({ error: 'no app id' }, { status: 500 })

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': keywords,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '10',
    'outputSelector': 'SellingStatus',
  })

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  const data = await res.json()

  const rawItems = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
  const items = rawItems.map((item: any) => ({
    title: item.title?.[0],
    price: parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
    currency: item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['@currencyId'] || 'USD',
    date: item.listingInfo?.[0]?.endTime?.[0],
    url: item.viewItemURL?.[0],
  })).filter((i: any) => i.price > 0)

  return NextResponse.json({ items })
}
