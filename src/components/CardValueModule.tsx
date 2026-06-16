'use client'
import { useEffect, useState } from 'react'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Valeur estimée</span>
      </div>
      <div style={{ height: 90, background: '#f7f7f7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

  // SVG chart dimensions
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

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Valeur estimée</span>
        {source === 'demo' && (
          <span style={{ fontSize: 9, color: '#ccc', fontWeight: 600 }}>— données démo</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: trendColor }}>
          {trendSign}{Math.round(trend * 100) / 100}{currency} sur 4 mois
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Graphique */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="cvm-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Grille légère */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
                stroke="#f0f0f0" strokeWidth="1" />
            ))}
            {/* Aire */}
            <path d={areaPath} fill="url(#cvm-area)" />
            {/* Ligne */}
            <path d={linePath} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dernier point mis en valeur */}
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={accent} />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="6" fill={accent} fillOpacity="0.2" />
          </svg>
        </div>

        {/* Valeurs */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 72, textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', marginBottom: 2 }}>Actuel</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: `rgb(${ar},${ag},${ab})`, lineHeight: 1 }}>
              {current}{currency}
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
