'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT  = '#003DA6'
const W_SVG   = 680

type DailyPoint = { day: string; count: number }
type Zoom = '3m' | '6m' | '1y' | 'max'

const ZOOM_CFG: Record<Zoom, { histDays: number; projDays: number; label: string }> = {
  '3m':  { histDays: 30,       projDays: 60,  label: '3 mois' },
  '6m':  { histDays: 90,       projDays: 90,  label: '6 mois' },
  '1y':  { histDays: Infinity, projDays: 275, label: '1 an'   },
  'max': { histDays: Infinity, projDays: 365, label: 'Max'    },
}

type Stats = {
  total_users: number
  today_users: number
  week_users: number
  month_users: number
  oldest_user: string
  total_cards: number
  total_cards_manual?: number
  today_cards: number
  week_cards: number
  month_cards: number
  oldest_card: string
  active_users_week: number
  active_users_month: number
  user_daily: DailyPoint[]
  card_daily: DailyPoint[]
}

// ── Utilitaires ───────────────────────────────────────────────────────────

function fmt(n: number)  { return n?.toLocaleString('fr-FR') ?? '—' }
function fmtY(v: number) {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

function safeAvg(total: number | undefined, oldest: string | null | undefined) {
  if (!oldest || !total) return { day: '—', week: '—', month: '—' }
  const days = Math.max(1, Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000))
  return {
    day:   (total / days).toFixed(1),
    week:  (total / (days / 7)).toFixed(1),
    month: (total / (days / 30)).toFixed(1),
  }
}

// Remplit tous les jours depuis le premier point jusqu'à aujourd'hui
function buildHistory(data: DailyPoint[]): DailyPoint[] {
  const map = new Map(data.map(p => [p.day.slice(0, 10), p.count]))
  const today = new Date()
  const earliest = data.length > 0
    ? data.reduce((m, p) => p.day.slice(0, 10) < m ? p.day.slice(0, 10) : m, data[0].day.slice(0, 10))
    : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const result: DailyPoint[] = []
  const cur = new Date(earliest + 'T12:00:00Z')
  while (cur <= today) {
    const day = cur.toISOString().slice(0, 10)
    result.push({ day, count: map.get(day) ?? 0 })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

// Régression linéaire sur les ajouts journaliers
function linReg(pts: DailyPoint[]) {
  const n = pts.length
  if (n < 2) return { slope: 0, intercept: pts[0]?.count ?? 0 }
  const ys    = pts.map(p => p.count)
  const sumX  = (n * (n - 1)) / 2
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = ys.reduce((s, y, i) => s + i * y, 0)
  const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6
  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  return { slope, intercept: (sumY - slope * sumX) / n }
}

// Boutons zoom partagés
function ZoomBtns({ zoom, setZoom, color }: { zoom: Zoom; setZoom: (z: Zoom) => void; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginBottom: 8 }}>
      {(Object.keys(ZOOM_CFG) as Zoom[]).map(z => (
        <button key={z} onClick={() => setZoom(z)} style={{
          padding: '3px 9px', fontSize: 11, borderRadius: 6,
          border: `1px solid ${zoom === z ? color : '#e2e8f0'}`,
          background: zoom === z ? color : '#fff',
          color: zoom === z ? '#fff' : '#64748b',
          cursor: 'pointer', fontWeight: zoom === z ? 600 : 400, transition: 'all .15s',
        }}>
          {ZOOM_CFG[z].label}
        </button>
      ))}
    </div>
  )
}

// Rendu SVG partagé
function ChartBody({ allVis, nVis, color, H, PL }: {
  allVis: DailyPoint[]; nVis: number; color: string; H: number; PL: number
  // les handlers sont appliqués par le parent sur la div wrapper
}) {
  const T  = allVis.length
  const PR = 12, PT = 20, PB = 28
  const cW = W_SVG - PL - PR, cH = H - PT - PB
  const maxVal = Math.max(1, ...allVis.map(p => p.count))

  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const visHist = allVis.slice(0, nVis)
  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = visHist.length > 1
    ? `${hPath}L${sx(nVis-1).toFixed(1)},${(PT+cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)}Z`
    : ''
  const pPath = allVis.slice(nVis - 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(nVis - 1 + i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')

  const yTicks = [0, Math.round(maxVal * 0.5), maxVal]
  const nLabels = Math.min(6, T)
  const labelIdx = Array.from({ length: nLabels }, (_, i) =>
    Math.round(i * (T - 1) / Math.max(1, nLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i)

  return { sx, sy, hPath, hArea, pPath, yTicks, labelIdx, maxVal, cW, cH, PT, PB, PR }
}

// ── Graphique cumulatif (total absolu au fil du temps) ───────────────────

function CumulativeChart({ data, totalToday, color }: {
  data: DailyPoint[]
  totalToday: number
  color: string
}) {
  const [zoom, setZoom]       = useState<Zoom>('3m')
  const [hovered, setHovered] = useState<number | null>(null)

  const dailyAll  = buildHistory(data)
  const nAll      = dailyAll.length
  const { slope, intercept } = linReg(dailyAll)

  // Série cumulée historique, ancrée au vrai total
  const rawSum = dailyAll.reduce((s, p) => s + p.count, 0)
  const scale  = rawSum > 0 ? totalToday / rawSum : 1
  let cumSoFar = 0
  const cumulativeAll: DailyPoint[] = dailyAll.map(p => {
    cumSoFar += p.count
    return { day: p.day, count: Math.round(cumSoFar * scale) }
  })

  // Projection cumulée 365j
  let projCum = totalToday
  const projAll: DailyPoint[] = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + i + 1)
    projCum += Math.max(0, Math.round(intercept + slope * (nAll + i)))
    return { day: d.toISOString().slice(0, 10), count: projCum }
  })

  const { histDays, projDays } = ZOOM_CFG[zoom]
  const visHist = histDays === Infinity ? cumulativeAll : cumulativeAll.slice(-histDays)
  const visProj = projAll.slice(0, projDays)
  const nVis    = visHist.length
  const allVis  = [...visHist, ...visProj]
  const T       = allVis.length
  const maxVal  = Math.max(1, ...allVis.map(p => p.count))

  const H = 240, PL = 62, PR = 12, PT = 20, PB = 28
  const cW = W_SVG - PL - PR, cH = H - PT - PB
  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = visHist.length > 1
    ? `${hPath}L${sx(nVis-1).toFixed(1)},${(PT+cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)}Z`
    : ''
  const pPath = [visHist[nVis-1], ...visProj]
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(nVis-1+i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')

  const yTicks = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.67), maxVal]
  const nLabels = Math.min(6, T)
  const labelIdx = Array.from({ length: nLabels }, (_, i) =>
    Math.round(i * (T - 1) / Math.max(1, nLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = (e.clientX - rect.left) * (W_SVG / rect.width)
    setHovered(Math.max(0, Math.min(T - 1, Math.round(((mx - PL) / cW) * (T - 1)))))
  }

  const hp     = hovered !== null ? allVis[hovered] : null
  const hx     = hovered !== null ? sx(hovered) : null
  const hy     = hp ? sy(hp.count) : null
  const isProj = hovered !== null && hovered >= nVis
  const proj1y = projAll[projAll.length - 1]?.count ?? 0
  const gain1y = proj1y - totalToday
  const tooltipPct  = hx !== null ? (hx / W_SVG) * 100 : 50
  const tooltipXfrm = tooltipPct < 12 ? 'translateX(0)' : tooltipPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div style={{ userSelect: 'none' }}>
      <ZoomBtns zoom={zoom} setZoom={z => { setZoom(z); setHovered(null) }} color={color} />
      <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W_SVG} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
        >
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W_SVG - PR} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL - 5} y={sy(t) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtY(t)}</text>
            </g>
          ))}
          <rect x={sx(nVis-1)} y={PT} width={Math.max(0, sx(T-1) - sx(nVis-1))} height={cH} fill="#f1f5f9" opacity={0.6} />
          {hArea && <path d={hArea} fill={color} opacity={0.08} />}
          {visHist.length > 1 && <path d={hPath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
          <path d={pPath} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.4} strokeLinejoin="round" />
          <line x1={sx(nVis-1)} x2={sx(nVis-1)} y1={PT} y2={PT+cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(nVis-1)} y={PT-4} textAnchor="middle" fontSize={8} fill="#94a3b8">auj.</text>
          {labelIdx.map(i => (
            <text key={i} x={sx(i)} y={H-6} textAnchor="middle" fontSize={8} fill={i >= nVis ? '#b0bec5' : '#64748b'}>
              {allVis[i]?.day.slice(5)}
            </text>
          ))}
          {hovered !== null && hx !== null && hy !== null && (
            <>
              <line x1={hx} x2={hx} y1={PT} y2={PT+cH} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={hx} cy={hy} r={5} fill={isProj ? '#fff' : color} stroke={color} strokeWidth={2} />
            </>
          )}
          <rect x={PL} y={PT} width={cW} height={cH} fill="transparent" />
        </svg>
        {hp && hx !== null && (
          <div style={{
            position: 'absolute', top: 8, left: `${tooltipPct}%`, transform: tooltipXfrm,
            background: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: 8,
            fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,.28)',
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>{hp.day}{isProj ? ' · projection' : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: isProj ? color + '88' : color }}>{fmt(hp.count)}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        <span style={{ fontSize: 10, fontStyle: 'italic' }}>régression linéaire sur ajouts journaliers</span>
        <span>dans 1 an : ~{fmt(proj1y)} <span style={{ color: '#059669' }}>(+{fmt(gain1y)})</span></span>
      </div>
    </div>
  )
}

// ── Graphique journalier (ajouts par jour) ────────────────────────────────

function DailyChart({ data, color }: { data: DailyPoint[]; color: string }) {
  const [zoom, setZoom]       = useState<Zoom>('3m')
  const [hovered, setHovered] = useState<number | null>(null)

  const dailyAll = buildHistory(data)
  const nAll     = dailyAll.length
  const { slope, intercept } = linReg(dailyAll)

  const projAll: DailyPoint[] = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + i + 1)
    return { day: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(intercept + slope * (nAll + i))) }
  })

  const { histDays, projDays } = ZOOM_CFG[zoom]
  const visHist = histDays === Infinity ? dailyAll : dailyAll.slice(-histDays)
  const visProj = projAll.slice(0, projDays)
  const nVis    = visHist.length
  const allVis  = [...visHist, ...visProj]
  const T       = allVis.length
  const maxVal  = Math.max(1, ...allVis.map(p => p.count))

  const H = 180, PL = 52, PR = 12, PT = 20, PB = 28
  const cW = W_SVG - PL - PR, cH = H - PT - PB
  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = visHist.length > 1
    ? `${hPath}L${sx(nVis-1).toFixed(1)},${(PT+cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)}Z`
    : ''
  const pPath = [visHist[nVis-1], ...visProj]
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(nVis-1+i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')

  const yTicks  = [0, Math.round(maxVal * 0.5), maxVal]
  const nLabels = Math.min(5, T)
  const labelIdx = Array.from({ length: nLabels }, (_, i) =>
    Math.round(i * (T - 1) / Math.max(1, nLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = (e.clientX - rect.left) * (W_SVG / rect.width)
    setHovered(Math.max(0, Math.min(T - 1, Math.round(((mx - PL) / cW) * (T - 1)))))
  }

  const hp     = hovered !== null ? allVis[hovered] : null
  const hx     = hovered !== null ? sx(hovered) : null
  const hy     = hp ? sy(hp.count) : null
  const isProj = hovered !== null && hovered >= nVis
  const proj1y = projAll[projAll.length - 1]?.count ?? 0
  const trendLabel = Math.abs(slope) < 0.5 ? '→ stable' : slope > 0 ? `↑ +${slope.toFixed(1)}/j` : `↓ ${slope.toFixed(1)}/j`
  const tooltipPct  = hx !== null ? (hx / W_SVG) * 100 : 50
  const tooltipXfrm = tooltipPct < 12 ? 'translateX(0)' : tooltipPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div style={{ userSelect: 'none' }}>
      <ZoomBtns zoom={zoom} setZoom={z => { setZoom(z); setHovered(null) }} color={color} />
      <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W_SVG} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
        >
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W_SVG - PR} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL - 5} y={sy(t) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{fmtY(t)}</text>
            </g>
          ))}
          <rect x={sx(nVis-1)} y={PT} width={Math.max(0, sx(T-1) - sx(nVis-1))} height={cH} fill="#f1f5f9" opacity={0.6} />
          {hArea && <path d={hArea} fill={color} opacity={0.08} />}
          {visHist.length > 1 && <path d={hPath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          <path d={pPath} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.4} strokeLinejoin="round" />
          <line x1={sx(nVis-1)} x2={sx(nVis-1)} y1={PT} y2={PT+cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(nVis-1)} y={PT-4} textAnchor="middle" fontSize={8} fill="#94a3b8">auj.</text>
          {labelIdx.map(i => (
            <text key={i} x={sx(i)} y={H-6} textAnchor="middle" fontSize={8} fill={i >= nVis ? '#b0bec5' : '#64748b'}>
              {allVis[i]?.day.slice(5)}
            </text>
          ))}
          {hovered !== null && hx !== null && hy !== null && (
            <>
              <line x1={hx} x2={hx} y1={PT} y2={PT+cH} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={hx} cy={hy} r={4.5} fill={isProj ? '#fff' : color} stroke={color} strokeWidth={2} />
            </>
          )}
          <rect x={PL} y={PT} width={cW} height={cH} fill="transparent" />
        </svg>
        {hp && hx !== null && (
          <div style={{
            position: 'absolute', top: 8, left: `${tooltipPct}%`, transform: tooltipXfrm,
            background: '#0f172a', color: '#fff', padding: '6px 12px', borderRadius: 8,
            fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,.28)',
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>{hp.day}{isProj ? ' · projection' : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: isProj ? color + '88' : color }}>{fmt(hp.count)}/jour</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        <span style={{ color: slope > 0.5 ? '#059669' : slope < -0.5 ? '#ef4444' : '#94a3b8' }}>{trendLabel}</span>
        <span>dans 1 an : ~{fmt(proj1y)}/jour</span>
      </div>
    </div>
  )
}

// ── Carte KPI ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
        {typeof value === 'number' ? fmt(value) : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Tableau stats ──────────────────────────────────────────────────────────

function StatsTable({ label, today, week, month, avgDay, avgWeek, avgMonth, note }: {
  label: string; today: number; week: number; month: number
  avgDay: string; avgWeek: string; avgMonth: string; note?: string
}) {
  const rows = [
    { period: "Aujourd'hui",        value: today  },
    { period: '7 derniers jours',   value: week   },
    { period: '30 derniers jours',  value: month  },
    { period: 'Moyenne / jour',     value: avgDay,   isAvg: true },
    { period: 'Moyenne / semaine',  value: avgWeek,  isAvg: true },
    { period: 'Moyenne / mois',     value: avgMonth, isAvg: true },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px', background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        {note && <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.75 }}>{note}</span>}
      </div>
      {rows.map(r => (
        <div key={r.period} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '11px 20px', borderBottom: '1px solid #f1f5f9',
          background: r.isAvg ? '#f8fafc' : '#fff',
        }}>
          <span style={{ fontSize: 13, color: r.isAvg ? '#64748b' : '#334155' }}>{r.period}</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: r.isAvg ? '#64748b' : ACCENT }}>
            {typeof r.value === 'number' ? fmt(r.value) : r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function AdminStats() {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Non connecté'); setLoading(false); return }
      const r = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (r.status === 403) { setError('Accès refusé — compte non admin'); setLoading(false); return }
      if (!r.ok) { setError(`Erreur ${r.status}`); setLoading(false); return }
      setStats(await r.json())
      setUpdatedAt(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Chargement…</div>
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
    </div>
  )
  if (!stats) return null

  const manualCards = stats.total_cards_manual ?? stats.total_cards
  const userAvg = safeAvg(stats.total_users,  stats.oldest_user)
  const cardAvg = safeAvg(manualCards,         stats.oldest_card || stats.oldest_user)

  const cardSub = stats.total_cards_manual != null
    ? `dont ${fmt(stats.total_cards_manual)} manuelles`
    : undefined

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Panel Admin</h1>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {updatedAt ? `Mis à jour ${updatedAt.toLocaleTimeString('fr-FR')}` : ''}
            </div>
          </div>
          <button onClick={load} style={{
            background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <KpiCard label="Inscrits total"              value={stats.total_users} />
          <KpiCard label="Cartes total"                value={stats.total_cards} sub={cardSub} />
          <KpiCard label="Nouveaux inscrits auj."      value={stats.today_users} />
          <KpiCard label="Cartes ajoutées auj."        value={stats.today_cards} />
        </div>

        {/* Graphiques cumulatifs */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Croissance cumulée
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Utilisateurs totaux</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{fmt(stats.total_users)}</div>
            </div>
            <CumulativeChart data={stats.user_daily} totalToday={stats.total_users} color={ACCENT} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Cartes totales</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>{fmt(stats.total_cards)}</div>
            </div>
            <CumulativeChart data={stats.card_daily} totalToday={stats.total_cards} color="#059669" />
          </div>
        </div>

        {/* Graphiques journaliers */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Activité journalière
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Inscriptions / jour</div>
            <DailyChart data={stats.user_daily} color={ACCENT} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Cartes ajoutées / jour</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>scanner seulement</div>
            </div>
            <DailyChart data={stats.card_daily} color="#059669" />
          </div>
        </div>

        {/* Tableaux stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <StatsTable
            label="👤 Inscriptions"
            today={stats.today_users} week={stats.week_users} month={stats.month_users}
            avgDay={userAvg.day} avgWeek={userAvg.week} avgMonth={userAvg.month}
          />
          <StatsTable
            label="🃏 Cartes ajoutées" note="scanner seulement"
            today={stats.today_cards} week={stats.week_cards} month={stats.month_cards}
            avgDay={cardAvg.day} avgWeek={cardAvg.week} avgMonth={cardAvg.month}
          />
        </div>

        {/* Utilisateurs actifs */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 14 }}>
            Utilisateurs actifs (ayant ajouté au moins 1 carte)
          </div>
          <div style={{ display: 'flex', gap: 48 }}>
            {[
              { label: 'Cette semaine',  value: stats.active_users_week  },
              { label: 'Ce mois',        value: stats.active_users_month },
              {
                label: 'Taux actifs / inscrits (mois)',
                value: stats.total_users
                  ? `${((stats.active_users_month / stats.total_users) * 100).toFixed(1)} %`
                  : '—',
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>
                  {typeof value === 'number' ? fmt(value) : value}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
