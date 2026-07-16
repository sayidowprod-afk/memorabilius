import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const GRADE_KEYWORDS = ['psa', 'bgs', 'sgc', 'cgc', 'beckett', 'graded', 'grade', 'gem', 'mint']

function titleMatchesCard(title: string, mustTerms: string[], isGraded: boolean): boolean {
  const t = normalize(title)
  if (!isGraded && GRADE_KEYWORDS.some(k => t.includes(k))) return false
  return mustTerms.every(term => t.includes(normalize(term)))
}

async function getOAuthToken(appId: string, certId: string, scope?: string): Promise<string | null> {
  try {
    const creds = Buffer.from(`${appId}:${certId}`).toString('base64')
    const encodedScope = encodeURIComponent(scope || 'https://api.ebay.com/oauth/api_scope')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&scope=${encodedScope}`,
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

function applyOutlierFilter(
  items: Array<{ title: string; price: number; url: string; img: string; soldDate: string }>
) {
  if (items.length >= 4) {
    const prices = [...items].map(i => i.price).sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    const med = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
    return items.filter(i => i.price >= med * 0.15 && i.price <= med * 5).slice(0, 20)
  }
  return items.slice(0, 20)
}

async function fetchSoldItems(
  keywords: string,
  mustTerms: string[],
  mustSetWord: string,
  isGraded: boolean,
  appId: string,
  token: string,
): Promise<{ items: Array<{ title: string; price: number; url: string; img: string; soldDate: string }>; debug: any }> {
  const debug: any = { keywords, mustTerms, mustSetWord }
  const now = new Date()

  const mapAndFilter = (items: any[], mapFn: (i: any) => { title: string; price: number; url: string; img: string; soldDate: string }) =>
    items.map(mapFn)
      .filter(i => i.price > 0)
      .filter(i => titleMatchesCard(i.title, mustTerms, isGraded))
      .filter(i => !mustSetWord || normalize(i.title).includes(normalize(mustSetWord)))

  // 1. Finding API findCompletedItems — itemFilter passé en brut (URLSearchParams encode les parenthèses).
  //    SoldOnly + AllCompleted en parallèle.
  const tryFinding = async (soldOnly: boolean): Promise<typeof mapAndFilter extends (...a: any[]) => infer R ? R : never> => {
    const base = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'GLOBAL-ID': 'EBAY-US',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '40',
      'sortOrder': 'EndTimeSoonest',
    })
    const filter = soldOnly ? '&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true' : ''
    const findingRes = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${base}${filter}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    )
    const body = await findingRes.text()
    debug[soldOnly ? 'findingSoldStatus' : 'findingCompletedStatus'] = findingRes.status
    debug[soldOnly ? 'findingSoldBody' : 'findingCompletedBody'] = body.slice(0, 150)
    if (!findingRes.ok || !body.startsWith('{')) return []
    const data = JSON.parse(body)
    const rawItems: any[] = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
    return mapAndFilter(rawItems, (item: any) => ({
      title: item.title?.[0] || '',
      price: parseFloat(item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
      url: item.viewItemURL?.[0] || '',
      img: item.galleryURL?.[0] || '',
      soldDate: item.listingInfo?.[0]?.endTime?.[0] || '',
    }))
  }

  const [soldItems, completedItems] = await Promise.allSettled([tryFinding(true), tryFinding(false)])
  const soldMapped = soldItems.status === 'fulfilled' ? soldItems.value : []
  const completedMapped = completedItems.status === 'fulfilled' ? completedItems.value : []
  debug.findingSoldOnly = soldMapped.length
  debug.findingCompleted = completedMapped.length
  const findingResult = soldMapped.length > 0 ? soldMapped : completedMapped
  if (findingResult.length > 0) return { items: applyOutlierFilter(findingResult), debug }

  // 2. Marketplace Insights API — endpoint eBay dédié aux ventes réalisées.
  try {
    const miRes = await fetch(
      `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(keywords)}&limit=40`,
      {
        headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    )
    const miBody = await miRes.text()
    debug.miStatus = miRes.status
    if (miRes.ok && miBody.startsWith('{')) {
      const miRaw: any[] = JSON.parse(miBody)?.itemSales || []
      debug.miRaw = miRaw.length
      const miMapped = mapAndFilter(miRaw, (item: any) => ({
        title: item.title || '',
        price: parseFloat(item.lastSoldPrice?.value || '0'),
        url: item.itemWebUrl || '',
        img: item.image?.imageUrl || '',
        soldDate: item.lastSoldDate || '',
      }))
      if (miMapped.length > 0) return { items: applyOutlierFilter(miMapped), debug }
    }
  } catch (e) {
    debug.miError = String(e)
  }

  // 3. Fallback Browse API — annonces actives comme proxy prix du marché.
  //    Finding API (svcs.ebay.com) est injoignable depuis Vercel, Marketplace Insights nécessite
  //    une approbation eBay. Les prix des annonces actives reflètent le marché réel.
  try {
    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keywords)}&filter=buyingOptions:{FIXED_PRICE|BEST_OFFER}&sort=price&limit=40`,
      {
        headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    )
    const body = await res.text()
    debug.browseStatus = res.status
    if (res.ok && body.startsWith('{')) {
      const rawItems: any[] = JSON.parse(body)?.itemSummaries || []
      debug.browseRaw = rawItems.length
      const mapped = mapAndFilter(rawItems, (item: any) => ({
        title: item.title || '',
        price: parseFloat(item.price?.value || '0'),
        url: item.itemWebUrl || '',
        img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
        soldDate: '',
      }))
      debug.browseMapped = mapped.length
      if (mapped.length > 0) return { items: applyOutlierFilter(mapped), debug }
    }
  } catch (e) {
    debug.browseError = String(e)
  }

  return { items: [], debug }
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
  const BRANDS = new Set(['donruss', 'topps', 'panini', 'bowman', 'fleer', 'prizm', 'optic', 'select', 'chronicles', 'mosaic', 'illusions', 'hoops', 'score', 'contenders', 'certified', 'absolute', 'revolution', 'status', 'noir', 'eminence', 'immaculate', 'national', 'treasures', 'spectra', 'obsidian', 'kaboom', 'phoenix'])
  const setWords = set.split(/\s+/).filter(w => w.length > 2 && !GENERIC.has(w.toLowerCase()))

  const keywordParts = [name, yearShort, set, variant, printRun || '', rc ? 'RC' : '', auto ? 'AUTO' : '', patch ? 'PATCH' : ''].filter(Boolean)
  const keywords = directQ || keywordParts.join(' ')

  // Browse API gère bien les longues requêtes — on utilise le titre complet
  const soldKeywords = directQ || keywords

  // mustTerms : filtre strict côté client après résultats Browse API
  // Pour directQ : joueur (2 mots) + année (4 chiffres) + marque du set
  const mustTerms: string[] = directQ
    ? (() => {
        const words = directQ.split(/\s+/)
        // Mots du nom joueur/insert : pas d'année, pas de #, pas générique, pas marque
        const nameWords = words
          .filter(w => w.length > 3 && !GENERIC.has(w.toLowerCase()) && !BRANDS.has(w.toLowerCase()) && !/^\d/.test(w) && !/^#/.test(w))
          .slice(0, 2)
        // Année 4 chiffres (2020 de "2020-21")
        const yearM = directQ.match(/\b((?:19|20)\d{2})\b/)
        // Marque du set (Donruss, Topps, etc.)
        const brand = words.find(w => BRANDS.has(w.toLowerCase()))
        return [...nameWords, ...(yearM ? [yearM[1]] : []), ...(brand ? [brand] : [])]
      })()
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
    const soldPromise = fetchSoldItems(soldKeywords, mustTerms, mustSetWord, isGraded, appId, token)

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

    const [active, soldResult] = await Promise.all([
      Promise.resolve(processItems(rawItems, mustTerms, mustSetWord, isGraded)),
      soldPromise,
    ])

    const sold = soldResult.items
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
      // debug temporaire — à retirer une fois le problème identifié
      _soldDebug: soldResult.debug,
    })
  } catch (err) {
    console.error('[ebay-sold]', err)
    return NextResponse.json({ items: [], active: [], sold: [] })
  }
}
