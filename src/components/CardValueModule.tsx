'use client'
import { useEffect, useRef, useState } from 'react'
import type { CardValueResponse } from '@/app/api/card-value/route'

interface Props {
  cardName: string
  set: string
  year: string
  num: string
  accent: string
}

export default function CardValueModule({ cardName, set, year, num, accent }: Props) {
  const [data, setData] = useState<CardValueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const q = [cardName, set, year, num].filter(Boolean).join(' ')
    fetch(`/api/card-value?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cardName, set, year, num])

  const ar = parseInt(accent.slice(1, 3), 16)
  const ag = parseInt(accent.slice(3, 5), 16)
  const ab = parseInt(accent.slice(5, 7), 16)

  if (loading) return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Valeur estimée</span>
      <div style={{ height: 90, background: '#f7f7f7', borderRadius: 10, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#ccc' }}>Chargement…</span>
      </div>
    </div>
  )

  if (!data || data.sales.length === 0) return null

  const { sales, current, min, max, currency, source } = data
  const prices = sales.map(s => s.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const W = 200, H = 72, PAD = 8
  const pts = sales.map((s, i) => ({
    x: PAD + (i / (sales.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (s.price - minP) / range) * (H - PAD * 2),
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`

  const trend = prices[prices.length - 1] - prices[0]
  const trendColor = trend >= 0 ? '#2e7d32' : '#c62828'
  const trendSign = trend >= 0 ? '+' : ''

  const hoveredSale = hovered !== null ? sales[hovered] : null
  const hoveredPt   = hovered !== null ? pts[hovered]   : null

  // Trouve l'index le plus proche de la position X de la souris dans le SVG
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

  // Formate la date "2024-11-03" → "3 nov. 2024"
  const fmtDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Tooltip : afficher à gauche si on est dans la 2ème moitié du graphique
  const tooltipLeft = hovered !== null && hovered > sales.length / 2

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Valeur estimée</span>
        {source === 'demo' && <span style={{ fontSize: 9, color: '#ccc', fontWeight: 600 }}>— données démo</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: trendColor }}>
          {trendSign}{Math.round(trend * 100) / 100}{currency} sur 4 mois
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Graphique */}
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
                <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
                stroke="#f0f0f0" strokeWidth="1" />
            ))}

            <path d={areaPath} fill="url(#cvm-area)" />
            <path d={linePath} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* Ligne verticale au hover */}
            {hoveredPt && (
              <line x1={hoveredPt.x} y1={PAD} x2={hoveredPt.x} y2={H}
                stroke={accent} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.5" />
            )}

            {/* Tous les points (petits) */}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 4 : 2}
                fill={hovered === i ? accent : '#fff'}
                stroke={accent} strokeWidth="1.5"
                style={{ transition: 'r 0.1s' }}
              />
            ))}

            {/* Tooltip SVG */}
            {hoveredPt && hoveredSale && (() => {
              const tx = tooltipLeft ? hoveredPt.x - 4 : hoveredPt.x + 4
              const anchor = tooltipLeft ? 'end' : 'start'
              const ty = Math.max(PAD + 14, hoveredPt.y - 6)
              return (
                <g>
                  <text x={tx} y={ty - 12} textAnchor={anchor}
                    fontSize="8" fontWeight="800" fill="#555">
                    {hoveredSale.price}{currency}
                  </text>
                  <text x={tx} y={ty - 3} textAnchor={anchor}
                    fontSize="7" fill="#aaa">
                    {fmtDate(hoveredSale.date)}
                  </text>
                </g>
              )
            })()}

            {/* Dernier point fixe (quand pas de hover) */}
            {hovered === null && (
              <>
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={accent} />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="6" fill={accent} fillOpacity="0.2" />
              </>
            )}
          </svg>
        </div>

        {/* Valeurs */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 72, textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', marginBottom: 2 }}>
              {hoveredSale ? fmtDate(hoveredSale.date) : 'Actuel'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: `rgb(${ar},${ag},${ab})`, lineHeight: 1, transition: '0.1s' }}>
              {hoveredSale ? hoveredSale.price : current}{currency}
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
    </div>
  )
}
