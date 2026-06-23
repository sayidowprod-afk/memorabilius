'use client'
import { useEffect, useRef, useState } from 'react'

interface Listing { price: number; title: string; url?: string }
interface MarketData {
  listings: Listing[]
  median: number
  min: number
  max: number
  count: number
  currency: string
}

interface Props {
  cardName: string
  set: string
  year: string
  num: string
  variant?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  accent: string
  img?: string
}

export default function CardValueModule({ cardName, set, year, num, variant, rc, auto, patch, accent, img }: Props) {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const printRun = num?.match(/\/\d+/) ? num.match(/\/\d+/)![0] : num
  const ebayUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent([cardName, variant, set, year, printRun, rc && 'RC', auto && 'AUTO', patch && 'PATCH'].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`

  useEffect(() => {
    if (!cardName) { setLoading(false); return }
    const params = new URLSearchParams({ name: cardName })
    if (set)     params.set('set', set)
    if (year)    params.set('year', year)
    if (num)     params.set('num', num)
    if (variant) params.set('variant', variant)
    if (rc)      params.set('rc', 'true')
    if (auto)    params.set('auto', 'true')
    if (patch)   params.set('patch', 'true')
    if (img)     params.set('img', img)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    fetch(`/api/ebay-sold?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then((json) => {
        clearTimeout(timeout)
        if (json.error || !json.items || json.items.length < 2) { setLoading(false); return }
        // Annonces déjà triées par prix croissant côté API
        const listings: Listing[] = json.items.map((i: any) => ({
          price: Math.round(i.price * 100) / 100,
          title: i.title || '',
          url: i.url || '',
        }))
        setData({
          listings,
          median: Math.round((json.median ?? 0) * 100) / 100,
          min: Math.round((json.min ?? 0) * 100) / 100,
          max: Math.round((json.max ?? 0) * 100) / 100,
          count: json.count ?? listings.length,
          currency: '€',
        })
        setLoading(false)
      })
      .catch(() => { clearTimeout(timeout); setLoading(false) })

    return () => { clearTimeout(timeout); controller.abort() }
  }, [cardName, set, year, num, variant, rc, auto, patch, img])

  const ar = parseInt(accent.slice(1, 3), 16)
  const ag = parseInt(accent.slice(3, 5), 16)
  const ab = parseInt(accent.slice(5, 7), 16)

  const ebayLink = (
    <a href={ebayUrl} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 11, fontWeight: 700, color: '#999', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #e8e8e8', borderRadius: 20, padding: '4px 10px', transition: '0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#bbb')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
    >
      🔍 Annonces eBay ↗
    </a>
  )

  if (!data || data.listings.length === 0) {
    return (
      <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: loading ? 8 : 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Annonces en vente</span>
          {ebayLink}
        </div>
        {loading && (
          <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${accent}33, ${accent}, ${accent}33)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          </div>
        )}
      </div>
    )
  }

  const { listings, median, min, max, count, currency } = data
  const prices = listings.map(l => l.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const W = 200, H = 52, PAD_X = 4, PAD_Y = 8
  // X = annonce triée par prix (du - cher au + cher), Y = prix
  const pts = listings.map((l, i) => ({
    x: PAD_X + (listings.length === 1 ? 0.5 : i / (listings.length - 1)) * (W - PAD_X * 2),
    y: PAD_Y + (1 - (l.price - minP) / range) * (H - PAD_Y * 2),
  }))

  // Courbe lissée via bezier cubique
  const smooth = (pts: { x: number, y: number }[]) => {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], cur = pts[i]
      const cpx = (prev.x + cur.x) / 2
      d += ` C ${cpx} ${prev.y} ${cpx} ${cur.y} ${cur.x} ${cur.y}`
    }
    return d
  }

  const linePath = smooth(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H + 2} L ${pts[0].x} ${H + 2} Z`

  // Position Y de la médiane pour la ligne de repère
  const medianY = PAD_Y + (1 - (median - minP) / range) * (H - PAD_Y * 2)

  const hoveredListing = hovered !== null ? listings[hovered] : null
  const hoveredPt       = hovered !== null ? pts[hovered]       : null

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const xSvg = xRatio * W
    let closest = 0, minDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - xSvg)
      if (d < minDist) { minDist = d; closest = i }
    })
    setHovered(closest)
  }

  // Titre eBay raccourci pour le tooltip
  const shortTitle = (t: string) => t.length > 42 ? t.slice(0, 40) + '…' : t

  const tooltipLeft = hovered !== null && hovered > listings.length / 2

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Annonces en vente</span>
        {ebayLink}
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#aaa' }}>
          {count} annonce{count !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Graphique : distribution des prix demandés */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="cvm-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>

            <path d={areaPath} fill="url(#cvm-area)" />
            <path d={linePath} fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

            {/* Ligne de repère médiane */}
            <line x1={PAD_X} y1={medianY} x2={W - PAD_X} y2={medianY}
              stroke="#bbb" strokeWidth="0.5" strokeDasharray="2 2" />

            {/* Ligne verticale au hover */}
            {hoveredPt && (
              <line x1={hoveredPt.x} y1={PAD_Y - 4} x2={hoveredPt.x} y2={H}
                stroke={accent} strokeWidth="0.8" strokeOpacity="0.35" />
            )}

            {hovered !== null && hoveredPt && (
              <circle cx={hoveredPt.x} cy={hoveredPt.y} r="3" fill={accent} />
            )}

            {/* Tooltip SVG au hover : prix uniquement (titre affiché en dessous) */}
            {hoveredPt && hoveredListing && (() => {
              const tx = tooltipLeft ? hoveredPt.x - 5 : hoveredPt.x + 5
              const anchor = tooltipLeft ? 'end' : 'start'
              const ty = Math.max(PAD_Y + 8, hoveredPt.y - 4)
              return (
                <text x={tx} y={ty - 4} textAnchor={anchor} fontSize="6.5" fontWeight="700" fill="#666">
                  {hoveredListing.price}{currency}
                </text>
              )
            })()}

            {hovered === null && (
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={accent} />
            )}
          </svg>
        </div>

        {/* Valeurs : médiane mise en avant comme prix de marché représentatif */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 72, textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', marginBottom: 2 }}>
              {hoveredListing ? 'Annonce' : 'Médiane'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: `rgb(${ar},${ag},${ab})`, lineHeight: 1, transition: '0.1s' }}>
              {hoveredListing ? hoveredListing.price : median}{currency}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase' }}>Min</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#555' }}>{min}{currency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase' }}>Max</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#555' }}>{max}{currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Titre de l'annonce survolée (cliquable) + mention honnête */}
      <div style={{ marginTop: 8, minHeight: 14 }}>
        {hoveredListing ? (
          hoveredListing.url ? (
            <a href={hoveredListing.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#888', textDecoration: 'none' }}>
              {shortTitle(hoveredListing.title)} ↗
            </a>
          ) : (
            <span style={{ fontSize: 10, color: '#888' }}>{shortTitle(hoveredListing.title)}</span>
          )
        ) : (
          <span style={{ fontSize: 9, color: '#ccc' }}>Prix demandés des annonces actuelles · pas un historique de ventes</span>
        )}
      </div>
    </div>
  )
}
