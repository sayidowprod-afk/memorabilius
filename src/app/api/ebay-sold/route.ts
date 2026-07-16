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

// img est une URL fournie par le client (image de la carte, potentiellement hébergée
// n'importe où pour les cartes CSV) et cette route est publique/sans auth : sans ce
// garde-fou, n'importe qui pourrait faire fetcher au serveur une URL interne/privée
// arbitraire (SSRF) via ce endpoint.
function isSafeExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (u.port && u.port !== '80' && u.port !== '443') return false
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
    // IPv4 littéral dans une plage privée/loopback/link-local
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (m) {
      const [a, b] = m.slice(1).map(Number)
      if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false
    }
    // IPv6 loopback/link-local/ULA
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false
    return true
  } catch {
    return false
  }
}

async function fetchImageBase64(url: string): Promise<string | null> {
  if (!isSafeExternalUrl(url)) return null
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
      img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
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
  return items.slice(0, 20)
}

async function fetchSoldItems(
  keywords: string,
  mustTerms: string[],
  mustSetWord: string,
  isGraded: boolean,
  appId: string,
): Promise<Array<{ title: string; price: number; url: string; img: string; soldDate: string }>> {
  try {
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'GLOBAL-ID': 'EBAY-US',
      'keywords': keywords,
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'paginationInput.entriesPerPage': '40',
      'sortOrder': 'EndTimeSoonest',
    })
    const res = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const data = await res.json()
    const rawItems: any[] = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

    const mapped = rawItems.map((item: any) => ({
      title: item.title?.[0] || '',
      price: parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || '0'),
      url: item.viewItemURL?.[0] || '',
      img: item.galleryURL?.[0] || '',
      soldDate: item.listingInfo?.[0]?.endTime?.[0] || '',
    }))
    .filter(i => i.price > 0 && titleMatchesCard(i.title, mustTerms, isGraded))
    .filter(i => !mustSetWord || normalize(i.title).includes(normalize(mustSetWord)))

    // Outlier filter
    if (mapped.length >= 4) {
      const prices = [...mapped].map(i => i.price).sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const med = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
      return mapped.filter(i => i.price >= med * 0.15 && i.price <= med * 5).slice(0, 20)
    }
    return mapped.slice(0, 20)
  } catch {
    return []
  }
}

function median(prices: number[]): number {
  if (!prices.length) return 0
  const sorted = [...prices].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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

  // ?q= permet de passer un titre eBay exact (depuis la recherche image) en court-circuit
  const directQ = searchParams.get('q') || ''

  if (!name && !directQ) return NextResponse.json({ items: [] })

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ error: 'missing credentials' }, { status: 500 })

  const normNum = (s: string) => { const m = s?.match(/\/(\d+)/); return m ? `/${m[1]}` : s }
  const printRun = normNum(num)
  const yearShort = year?.match(/^(\d{4})/)?.[1] || year

  const GENERIC = new Set(['panini', 'topps', 'upper', 'deck', 'donruss', 'fleer', 'nba', 'nfl', 'mlb', 'basketball', 'football', 'baseball', 'card', 'cards'])
  const setWords = set.split(/\s+/).filter(w => w.length > 2 && !GENERIC.has(w.toLowerCase()))

  const keywordParts = [name, yearShort, set, variant, printRun || '', rc ? 'RC' : '', auto ? 'AUTO' : '', patch ? 'PATCH' : ''].filter(Boolean)
  const keywords = directQ || keywordParts.join(' ')

  // Pour la recherche vendues (Finding API), le titre complet eBay donne 0 résultat car l'API
  // fait un AND strict sur tous les mots. On exclut les mots courts (stop words "the", "in"),
  // les génériques, les années numériques (format "2020-21" cause des faux-négatifs AND) et les #.
  const soldKeywords = directQ
    ? directQ.split(/\s+/)
        .filter(w => w.length > 3 && !GENERIC.has(w.toLowerCase()) && !/^\d/.test(w) && !/^#/.test(w))
        .slice(0, 5)
        .join(' ')
    : keywords

  // mustTerms plus lâches pour directQ : 2 mots non-numériques pour éviter les faux-négatifs
  // liés aux formats d'année (202223 vs 2223 selon les vendeurs)
  const mustTerms: string[] = directQ
    ? directQ.split(/\s+/)
        .filter(w => w.length > 3 && !GENERIC.has(w.toLowerCase()) && !/^\d/.test(w) && !/^#/.test(w))
        .slice(0, 2)
    : [name]
  if (!directQ && yearShort) mustTerms.push(yearShort)
  if (!directQ && printRun) mustTerms.push(printRun.replace('/', ''))
  if (!directQ && auto) mustTerms.push('auto')
  if (!directQ && rc) mustTerms.push('rc')
  const mustSetWord = directQ ? '' : (setWords[0] || '')
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

    // Active listings + sold comps en parallèle
    const soldPromise = fetchSoldItems(soldKeywords, mustTerms, mustSetWord, isGraded, appId)

    let rawItems: any[] = []

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

    const imgFiltered = processItems(rawItems, mustTerms, mustSetWord, isGraded)
    if (imgFiltered.length < 3) {
      const browseParams = new URLSearchParams({
        q: keywords,
        filter: 'buyingOptions:{FIXED_PRICE|BEST_OFFER}',
        limit: '30',
        sort: 'price',
      })
      const textRes = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${browseParams}`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })
      const textData = await textRes.json()
      const textItems = textData?.itemSummaries || []
      const seen = new Set(rawItems.map((i: any) => i.itemId))
      rawItems = [...rawItems, ...textItems.filter((i: any) => !seen.has(i.itemId))]
    }

    clearTimeout(timeout)

    const [active, sold] = await Promise.all([
      Promise.resolve(processItems(rawItems, mustTerms, mustSetWord, isGraded)),
      soldPromise,
    ])

    const soldPrices = sold.map(i => i.price)

    return NextResponse.json({
      // ventes en cours
      active,
      // ventes réalisées (pour la valeur marché)
      sold,
      soldCount: sold.length,
      median: median(soldPrices),
      min: soldPrices.length ? Math.min(...soldPrices) : 0,
      max: soldPrices.length ? Math.max(...soldPrices) : 0,
      // compat ancien code
      items: active,
      count: active.length,
    })
  } catch (err) {
    console.error('[ebay-sold]', err)
    return NextResponse.json({ items: [], active: [], sold: [] })
  }
}
