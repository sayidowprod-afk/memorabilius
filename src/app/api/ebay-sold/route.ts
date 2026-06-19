import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const GRADE_KEYWORDS = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded', 'grade', 'gem', 'mint']

function titleMatchesCard(title: string, mustTerms: string[], isGraded: boolean): boolean {
  const t = normalize(title)
  if (!isGraded && GRADE_KEYWORDS.some(k => t.includes(k))) return false
  return mustTerms.every(term => t.includes(normalize(term)))
}

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

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    const buf = await r.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  } catch {
    return null
  }
}

function processItems(rawItems: any[], mustTerms: string[], mustSetWord: string, isGraded: boolean) {
  const filtered = rawItems
    .map((item: any) => ({
      title: item.title || '',
      price: parseFloat(item.price?.value || '0'),
      url: item.itemWebUrl || '',
    }))
    .filter((i) => i.price > 0)
    .filter((i) => titleMatchesCard(i.title, mustTerms, isGraded))
    .filter((i) => !mustSetWord || normalize(i.title).includes(normalize(mustSetWord)))
    .sort((a, b) => a.price - b.price)

  let items = filtered
  if (items.length >= 4) {
    const mid = Math.floor(items.length / 2)
    const median = items.length % 2 === 0
      ? (items[mid - 1].price + items[mid].price) / 2
      : items[mid].price
    items = items.filter((i) => i.price >= median * 0.15 && i.price <= median * 5)
  }
  return items.slice(0, 10)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const name    = searchParams.get('name') || ''
  const set     = searchParams.get('set') || ''
  const year    = searchParams.get('year') || ''
  const num     = searchParams.get('num') || ''
  const variant = searchParams.get('variant') || ''
  const rc      = searchParams.get('rc') === 'true'
  const auto    = searchParams.get('auto') === 'true'
  const patch   = searchParams.get('patch') === 'true'
  const grade   = searchParams.get('grade') || ''
  const imgUrl  = searchParams.get('img') || ''

  if (!name) return NextResponse.json({ items: [] })

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ error: 'missing credentials' }, { status: 500 })

  const normNum = (s: string) => { const m = s?.match(/\/(\d+)/); return m ? `/${m[1]}` : s }
  const printRun = normNum(num)
  const yearShort = year?.match(/^(\d{4})/)?.[1] || year

  const GENERIC = new Set(['panini', 'topps', 'upper', 'deck', 'donruss', 'fleer', 'nba', 'nfl', 'mlb', 'basketball', 'football', 'baseball', 'card', 'cards'])
  const setWords = set.split(/\s+/).filter(w => w.length > 2 && !GENERIC.has(w.toLowerCase()))

  const keywordParts = [name, yearShort, set, variant, printRun || '', rc ? 'RC' : '', auto ? 'AUTO' : '', patch ? 'PATCH' : ''].filter(Boolean)
  const keywords = keywordParts.join(' ')

  const mustTerms: string[] = [name]
  if (yearShort) mustTerms.push(yearShort)
  if (printRun) mustTerms.push(printRun.replace('/', ''))
  if (auto) mustTerms.push('auto')
  if (rc) mustTerms.push('rc')
  const mustSetWord = setWords[0] || ''
  const isGraded = Boolean(grade && grade !== 'Raw' && grade !== 'Non gradée' && grade !== '')

  const token = await getOAuthToken(appId, certId)
  if (!token) return NextResponse.json({ items: [] })

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    'Content-Type': 'application/json',
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    let rawItems: any[] = []

    // 1. Recherche par image si disponible (plus précise)
    if (imgUrl) {
      const imgBase64 = await fetchImageBase64(imgUrl)
      if (imgBase64) {
        const imgRes = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search_by_image?limit=30&filter=buyingOptions:{FIXED_PRICE|BEST_OFFER}', {
          method: 'POST',
          headers,
          body: JSON.stringify({ image: imgBase64 }),
          signal: controller.signal,
          cache: 'no-store',
        })
        const imgData = await imgRes.json()
        rawItems = imgData?.itemSummaries || []
      }
    }

    // 2. Si recherche par image insuffisante (<3 résultats après filtrage), compléter par texte
    const imgFiltered = processItems(rawItems, mustTerms, mustSetWord, isGraded)
    if (imgFiltered.length < 3) {
      const params = new URLSearchParams({
        q: keywords,
        filter: 'buyingOptions:{FIXED_PRICE|BEST_OFFER}',
        limit: '30',
        sort: 'price',
      })
      const textRes = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })
      const textData = await textRes.json()
      const textItems = textData?.itemSummaries || []

      // Fusion : items image en premier (plus pertinents), puis texte si pas déjà présents
      const seen = new Set(rawItems.map((i: any) => i.itemId))
      rawItems = [...rawItems, ...textItems.filter((i: any) => !seen.has(i.itemId))]
    }

    clearTimeout(timeout)

    const items = processItems(rawItems, mustTerms, mustSetWord, isGraded)

    const now = new Date()
    const withDates = items.map((item, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (items.length - 1 - i) * Math.floor(30 / Math.max(items.length - 1, 1)))
      return { ...item, date: d.toISOString().slice(0, 10) }
    })

    return NextResponse.json({ items: withDates })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
