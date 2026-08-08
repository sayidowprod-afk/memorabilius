'use client'
import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const GeoMap = dynamic(() => import('@/components/admin/GeoMap'), { ssr: false })

const ACCENT = '#003DA6'
const W_SVG  = 800

type DailyPoint = { day: string; count: number }
type Zoom = '3m' | '6m' | '1y' | 'max'

const ZOOM_CFG: Record<Zoom, { histDays: number; projDays: number; label: string }> = {
  '3m':  { histDays: 30,       projDays: 60,  label: '3 mois' },
  '6m':  { histDays: 90,       projDays: 90,  label: '6 mois' },
  '1y':  { histDays: Infinity, projDays: 275, label: '1 an'   },
  'max': { histDays: Infinity, projDays: 365, label: 'Max'    },
}

type TopUser    = { name: string; cards: number }
type FieldCount = { field: string; count: number }
type MarqueCount = { marque: string; count: number }

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
  // IA / coûts
  total_scans: number
  scans_today: number
  scans_week: number
  scans_month: number
  estimated_cost_eur: number
  cost_month_eur: number
  // Qualité IA
  scan_total_training: number
  scan_corrected_count: number
  top_corrected_fields: FieldCount[]
  // Collection
  cards_with_rc: number
  cards_with_auto: number
  cards_with_patch: number
  cards_with_num: number
  cards_with_photo: number
  avg_card_completeness: number
  top_marques: MarqueCount[]
  // Engagement
  total_binders: number
  total_trade_offers: number
  trade_offers_accepted: number
  trade_offers_pending: number
  // Funnel
  funnel_registered: number
  funnel_scanned: number
  funnel_first_card: number
  // Rétention & churn
  retention_d7_count: number
  retention_d7_base: number
  prev_retention_d7_count: number
  prev_retention_d7_base: number
  retention_d30_count: number
  retention_d30_base: number
  dau: number
  prev_mau: number
  churn_count: number
  churn_base: number
  prev_churn_count: number
  prev_churn_base: number
  // Nouveaux
  activation_delay_median: number | null
  donor_count: number
  top_users: TopUser[]
  // 7 derniers jours
  last_7_days?: {
    users:     DailyPoint[]
    cards:     DailyPoint[]
    active:    DailyPoint[]   // distinct users ayant fait une action
    pageviews: DailyPoint[] | null  // null = VERCEL_TOKEN non configuré
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────

function fmt(n: number)  { return n?.toLocaleString('fr-FR') ?? '—' }

// Calcule le score de santé global (0-100)
function healthScore(s: Stats): { score: number; grade: string; color: string; components: { label: string; score: number; value: string }[] } {
  const mau          = s.active_users_month || 1
  const dauMauRate   = (s.dau ?? 0) / mau
  const d7Rate       = s.retention_d7_base  ? s.retention_d7_count  / s.retention_d7_base  : 0
  const churnRate    = s.churn_base          ? s.churn_count         / s.churn_base          : 0
  const funnelRate   = (s.funnel_registered || 1) ? (s.retention_d7_count ?? 0) / (s.funnel_registered || 1) : 0

  const s1 = Math.min(100, (dauMauRate  / 0.20) * 100)
  const s2 = Math.min(100, (d7Rate      / 0.40) * 100)
  const s3 = Math.max(0,   100 - (churnRate / 0.40) * 100)
  const s4 = Math.min(100, (funnelRate  / 0.30) * 100)

  const score = Math.round(s1 * 0.25 + s2 * 0.30 + s3 * 0.25 + s4 * 0.20)
  const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'À améliorer'
  const color = score >= 80 ? '#059669'   : score >= 60 ? '#0ea5e9' : score >= 40 ? '#f59e0b' : '#ef4444'
  return {
    score, grade, color,
    components: [
      { label: 'DAU/MAU',    score: Math.round(s1), value: `${(dauMauRate * 100).toFixed(1)} %` },
      { label: 'Rétention D7', score: Math.round(s2), value: `${(d7Rate * 100).toFixed(1)} %` },
      { label: 'Churn',      score: Math.round(s3), value: `${(churnRate * 100).toFixed(1)} %` },
      { label: 'Funnel D7',  score: Math.round(s4), value: `${(funnelRate * 100).toFixed(1)} %` },
    ],
  }
}

// Delta vs période précédente
function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return null
  const delta = ((cur - prev) / prev) * 100
  const positive = invert ? delta < 0 : delta > 0
  const abs = Math.abs(delta)
  if (abs < 0.5) return <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>→</span>
  return (
    <span style={{
      fontSize: 11, marginLeft: 6,
      color: positive ? '#059669' : '#ef4444',
      background: positive ? '#f0fdf4' : '#fef2f2',
      borderRadius: 4, padding: '1px 6px',
    }}>
      {positive ? '↑' : '↓'} {abs.toFixed(1)} %
    </span>
  )
}

// Benchmark : indique si une métrique est bonne/moyenne/mauvaise
function Bench({ value, good, ok, label, invert = false }: {
  value: number; good: number; ok: number; label: string; invert?: boolean
}) {
  const isGood = invert ? value <= good : value >= good
  const isOk   = invert ? value <= ok   : value >= ok
  const color   = isGood ? '#059669' : isOk ? '#f59e0b' : '#ef4444'
  const text    = isGood ? 'Excellent' : isOk ? 'Correct' : 'À améliorer'
  const ref     = invert ? `Ref: <${(good * 100).toFixed(0)} %` : `Ref: >${(good * 100).toFixed(0)} %`
  return (
    <div style={{ fontSize: 10, color, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontWeight: 700 }}>{text}</span>
      <span style={{ color: '#94a3b8' }}>{ref}</span>
    </div>
  )
}
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

// Moyenne des N derniers jours
function rollingAvg(pts: DailyPoint[], n = 7): number {
  const slice = pts.slice(-n)
  if (!slice.length) return 0
  return slice.reduce((s, p) => s + p.count, 0) / slice.length
}

// Tendance : compare moy. 7j vs 7j précédents
function trendVsPrev(pts: DailyPoint[]): '↑' | '↓' | '→' {
  const cur  = rollingAvg(pts, 7)
  const prev = rollingAvg(pts.slice(0, -7), 7)
  if (prev === 0) return '→'
  const delta = (cur - prev) / prev
  return delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→'
}

// Boutons zoom
function ZoomBtns({ zoom, setZoom, color }: { zoom: Zoom; setZoom: (z: Zoom) => void; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(Object.keys(ZOOM_CFG) as Zoom[]).map(z => (
        <button key={z} onClick={() => setZoom(z)} style={{
          padding: '3px 10px', fontSize: 11, borderRadius: 6,
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

// ── Graphique cumulatif ───────────────────────────────────────────────────

function CumulativeChart({ data, totalToday, color }: {
  data: DailyPoint[]
  totalToday: number
  color: string
}) {
  const [zoom, setZoom]       = useState<Zoom>('3m')
  const [hovered, setHovered] = useState<number | null>(null)

  const dailyAll = buildHistory(data)
  const rate7    = rollingAvg(dailyAll, 7)   // moy. 7 derniers jours
  const trend    = trendVsPrev(dailyAll)

  // Série cumulée historique, ancrée au vrai total aujourd'hui
  const rawSum = dailyAll.reduce((s, p) => s + p.count, 0)
  const scale  = rawSum > 0 ? totalToday / rawSum : 1
  let cumSoFar = 0
  const cumulativeAll: DailyPoint[] = dailyAll.map(p => {
    cumSoFar += p.count
    return { day: p.day, count: Math.round(cumSoFar * scale) }
  })

  // Projection cumulée 365j à taux fixe = moy. 7j
  let projCum = totalToday
  const projAll: DailyPoint[] = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + i + 1)
    projCum += Math.round(rate7)
    return { day: d.toISOString().slice(0, 10), count: projCum }
  })

  const { histDays, projDays } = ZOOM_CFG[zoom]
  const visHist = histDays === Infinity ? cumulativeAll : cumulativeAll.slice(-histDays)
  const visProj = projAll.slice(0, projDays)
  const nVis    = visHist.length
  const allVis  = [...visHist, ...visProj]
  const T       = allVis.length
  const maxVal  = Math.max(1, ...allVis.map(p => p.count))

  const H = 280, PL = 66, PR = 16, PT = 22, PB = 30
  const cW = W_SVG - PL - PR, cH = H - PT - PB
  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = visHist.length > 1
    ? `${hPath}L${sx(nVis-1).toFixed(1)},${(PT+cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)}Z`
    : ''
  const pPath = [visHist[nVis-1], ...visProj]
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(nVis-1+i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')

  const yTicks  = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.67), maxVal]
  const nLabels = Math.min(7, T)
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
  const tooltipXfrm = tooltipPct < 10 ? 'translateX(0)' : tooltipPct > 90 ? 'translateX(-100%)' : 'translateX(-50%)'
  const trendColor  = trend === '↑' ? '#059669' : trend === '↓' ? '#ef4444' : '#94a3b8'

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <ZoomBtns zoom={zoom} setZoom={z => { setZoom(z); setHovered(null) }} color={color} />
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <span style={{ fontWeight: 600, color: trendColor }}>{trend} </span>
          moy. 7j : <span style={{ fontWeight: 600 }}>{fmt(Math.round(rate7))}/j</span>
        </div>
      </div>

      <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W_SVG} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
        >
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W_SVG-PR} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL-6} y={sy(t)+4} textAnchor="end" fontSize={10} fill="#94a3b8">{fmtY(t)}</text>
            </g>
          ))}

          {/* Fond zone projection */}
          <rect x={sx(nVis-1)} y={PT} width={Math.max(0, sx(T-1)-sx(nVis-1))} height={cH} fill="#f8fafc" />

          {/* Légende projection */}
          <text x={sx(nVis-1) + 6} y={PT+12} fontSize={8} fill="#94a3b8" fontStyle="italic">
            projection ({fmt(Math.round(rate7))}/j)
          </text>

          {/* Area + ligne historique */}
          {hArea && <path d={hArea} fill={color} opacity={0.08} />}
          {visHist.length > 1 && (
            <path d={hPath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Ligne projection pointillée */}
          <path d={pPath} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.45} strokeLinejoin="round" />

          {/* Aujourd'hui */}
          <line x1={sx(nVis-1)} x2={sx(nVis-1)} y1={PT} y2={PT+cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(nVis-1)} y={PT-5} textAnchor="middle" fontSize={8} fill="#94a3b8">auj.</text>

          {/* Labels X */}
          {labelIdx.map(i => (
            <text key={i} x={sx(i)} y={H-8} textAnchor="middle" fontSize={9} fill={i >= nVis ? '#b0bec5' : '#64748b'}>
              {allVis[i]?.day.slice(5)}
            </text>
          ))}

          {/* Crosshair */}
          {hovered !== null && hx !== null && hy !== null && (
            <>
              <line x1={hx} x2={hx} y1={PT} y2={PT+cH} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={hx} cy={hy} r={5} fill={isProj ? '#fff' : color} stroke={color} strokeWidth={2} />
            </>
          )}
          <rect x={PL} y={PT} width={cW} height={cH} fill="transparent" />
        </svg>

        {/* Tooltip */}
        {hp && hx !== null && (
          <div style={{
            position: 'absolute', top: 10, left: `${tooltipPct}%`, transform: tooltipXfrm,
            background: '#0f172a', color: '#fff', padding: '7px 13px', borderRadius: 8,
            fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,.3)',
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 3 }}>
              {hp.day}{isProj ? ' · projection' : ''}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: isProj ? color + '99' : color }}>
              {fmt(hp.count)}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        dans 1 an : <span style={{ fontWeight: 600, color: '#334155', marginLeft: 4 }}>~{fmt(proj1y)}</span>
        <span style={{ color: '#059669', marginLeft: 6 }}>(+{fmt(gain1y)})</span>
      </div>
    </div>
  )
}

// ── Graphique journalier ──────────────────────────────────────────────────

function DailyChart({ data, color }: { data: DailyPoint[]; color: string }) {
  const [zoom, setZoom]       = useState<Zoom>('3m')
  const [hovered, setHovered] = useState<number | null>(null)

  const dailyAll = buildHistory(data)
  const rate7    = rollingAvg(dailyAll, 7)
  const trend    = trendVsPrev(dailyAll)

  const { histDays } = ZOOM_CFG[zoom]
  const visHist = histDays === Infinity ? dailyAll : dailyAll.slice(-histDays)
  const T       = visHist.length
  const maxVal  = Math.max(1, ...visHist.map(p => p.count))

  const H = 200, PL = 58, PR = 16, PT = 22, PB = 30
  const cW = W_SVG - PL - PR, cH = H - PT - PB
  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = visHist.length > 1
    ? `${hPath}L${sx(T-1).toFixed(1)},${(PT+cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)}Z`
    : ''

  const yTicks  = [0, Math.round(maxVal * 0.5), maxVal]
  const nLabels = Math.min(6, T)
  const labelIdx = Array.from({ length: nLabels }, (_, i) =>
    Math.round(i * (T - 1) / Math.max(1, nLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = (e.clientX - rect.left) * (W_SVG / rect.width)
    setHovered(Math.max(0, Math.min(T - 1, Math.round(((mx - PL) / cW) * (T - 1)))))
  }

  const hp    = hovered !== null ? visHist[hovered] : null
  const hx    = hovered !== null ? sx(hovered) : null
  const hy    = hp ? sy(hp.count) : null
  const tooltipPct  = hx !== null ? (hx / W_SVG) * 100 : 50
  const tooltipXfrm = tooltipPct < 10 ? 'translateX(0)' : tooltipPct > 90 ? 'translateX(-100%)' : 'translateX(-50%)'
  const trendColor  = trend === '↑' ? '#059669' : trend === '↓' ? '#ef4444' : '#94a3b8'

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <ZoomBtns zoom={zoom} setZoom={z => { setZoom(z); setHovered(null) }} color={color} />
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <span style={{ fontWeight: 600, color: trendColor }}>{trend} </span>
          moy. 7j : <span style={{ fontWeight: 600 }}>{fmt(Math.round(rate7))}/j</span>
        </div>
      </div>

      <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${W_SVG} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
        >
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W_SVG-PR} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL-6} y={sy(t)+4} textAnchor="end" fontSize={10} fill="#94a3b8">{fmtY(t)}</text>
            </g>
          ))}

          {hArea && <path d={hArea} fill={color} opacity={0.08} />}
          {visHist.length > 1 && (
            <path d={hPath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {labelIdx.map(i => (
            <text key={i} x={sx(i)} y={H-8} textAnchor="middle" fontSize={9} fill="#64748b">
              {visHist[i]?.day.slice(5)}
            </text>
          ))}

          {hovered !== null && hx !== null && hy !== null && (
            <>
              <line x1={hx} x2={hx} y1={PT} y2={PT+cH} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={hx} cy={hy} r={4.5} fill={color} stroke={color} strokeWidth={2} />
            </>
          )}
          <rect x={PL} y={PT} width={cW} height={cH} fill="transparent" />
        </svg>

        {hp && hx !== null && (
          <div style={{
            position: 'absolute', top: 10, left: `${tooltipPct}%`, transform: tooltipXfrm,
            background: '#0f172a', color: '#fff', padding: '7px 13px', borderRadius: 8,
            fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,.3)',
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 3 }}>{hp.day}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color }}>{fmt(hp.count)}/jour</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tableau 7 derniers jours ──────────────────────────────────────────────

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function Last7DaysTable({ data }: {
  data: { users: DailyPoint[]; cards: DailyPoint[]; active: DailyPoint[]; pageviews: DailyPoint[] | null }
}) {
  const today = new Date().toISOString().slice(0, 10)
  const COLS = [
    { label: '👤 Inscrits',   color: ACCENT,    series: data.users,     note: '' },
    { label: '🃏 Cartes',     color: '#059669', series: data.cards,     note: '' },
    { label: '⚡ Actifs',     color: '#8b5cf6', series: data.active,    note: 'dernière connexion ce jour' },
    { label: '👁 Pages vues', color: '#f59e0b', series: data.pageviews, note: data.pageviews ? '' : 'VERCEL_TOKEN requis' },
  ]
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', minWidth: 560 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: ACCENT }}>
              <th style={{ padding: '10px 16px', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'left' }}>Jour</th>
              {COLS.map(c => (
                <th key={c.label} style={{ padding: '10px 16px', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.label}
                  {c.note && <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>{c.note}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map((u, i) => {
              const isToday = u.day === today
              const d       = new Date(u.day + 'T12:00:00Z')
              const label   = `${DAY_LABELS[d.getUTCDay()]} ${u.day.slice(5)}`
              return (
                <tr key={u.day} style={{
                  background: isToday ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? ACCENT : '#334155' }}>
                    {label}{isToday ? ' · auj.' : ''}
                  </td>
                  {COLS.map((c, j) => {
                    const v = c.series ? (c.series[i]?.count ?? 0) : -1
                    return (
                      <td key={j} style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 600, fontSize: 14, color: v > 0 ? c.color : '#cbd5e1' }}>
                        {v < 0 ? <span style={{ fontSize: 11, color: '#94a3b8' }}>N/A</span> : v > 0 ? fmt(v) : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
              <td style={{ padding: '9px 16px', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Total 7j</td>
              {COLS.map((c, j) => {
                const total = c.series ? c.series.reduce((s, p) => s + p.count, 0) : -1
                return (
                  <td key={j} style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: c.color }}>
                    {total < 0 ? <span style={{ fontSize: 11, color: '#94a3b8' }}>N/A</span> : fmt(total)}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Carte KPI ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
        {typeof value === 'number' ? fmt(value) : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Tableau stats ─────────────────────────────────────────────────────────

function StatsTable({ label, today, week, month, avgDay, avgWeek, avgMonth, note }: {
  label: string; today: number; week: number; month: number
  avgDay: string; avgWeek: string; avgMonth: string; note?: string
}) {
  const rows = [
    { period: "Aujourd'hui",       value: today  },
    { period: '7 derniers jours',  value: week   },
    { period: '30 derniers jours', value: month  },
    { period: 'Moyenne / jour',    value: avgDay,   isAvg: true },
    { period: 'Moyenne / semaine', value: avgWeek,  isAvg: true },
    { period: 'Moyenne / mois',    value: avgMonth, isAvg: true },
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

// ── Section header ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

// ── Section Géographie ────────────────────────────────────────────────────

// [lon, lat]
const GEO_CENTROIDS: Record<string, [number, number]> = {
  FR:[2.3,46.2],US:[-95.7,37.1],CA:[-106.3,56.1],GB:[-3.4,55.4],
  DE:[10.5,51.2],BE:[4.5,50.5],CH:[8.2,46.8],NL:[5.3,52.1],
  ES:[-3.7,40.4],IT:[12.6,41.9],PT:[-8.2,39.4],AU:[133.8,-25.3],
  BR:[-51.9,-14.2],MX:[-102.5,23.6],JP:[138.3,36.2],KR:[127.8,35.9],
  AR:[-63.6,-38.4],MA:[-7.1,31.8],SN:[-14.5,14.5],CI:[-5.5,7.5],
  ZA:[22.9,-30.6],NG:[7.5,10.5],RU:[100.0,60.0],CN:[104.2,35.9],
  IN:[78.9,20.6],SE:[15.0,62.0],NO:[8.5,60.5],DK:[9.5,56.3],
  PL:[19.1,51.9],AT:[14.5,47.5],LU:[6.1,49.6],MC:[7.4,43.7],
  DZ:[2.6,28.0],TN:[9.6,33.9],CM:[12.4,5.7],SG:[103.8,1.4],
  HK:[114.1,22.4],AE:[54.0,24.0],IL:[34.9,31.0],TR:[35.2,39.0],
  PK:[69.3,30.4],BD:[90.4,23.7],TH:[100.9,15.9],VN:[108.3,14.1],
  MY:[108.0,4.2],ID:[113.9,-0.8],PH:[121.8,12.9],NZ:[174.9,-40.9],
  GH:[-1.0,7.9],EG:[30.8,26.8],ET:[40.5,9.1],TZ:[34.9,-6.4],
  UA:[31.2,48.4],CZ:[15.5,49.8],RO:[24.9,45.9],HU:[19.5,47.2],
  FI:[26.0,64.0],SK:[19.7,48.7],HR:[15.2,45.1],BG:[25.5,42.7],
  CL:[-71.5,-35.7],CO:[-74.1,4.6],PE:[-75.0,-9.2],VE:[-66.6,6.4],
  LT:[24.0,56.0],LV:[24.6,56.9],EE:[25.0,58.6],RS:[21.0,44.0],
  GR:[21.8,39.1],CY:[33.4,35.1],IE:[-8.2,53.1],
  HT:[-72.7,18.9],RE:[55.5,-21.1],GP:[-61.5,16.2],MQ:[-61.0,14.6],
  GF:[-53.1,3.9],NC:[166.0,-20.9],PF:[-149.5,-17.5],MU:[57.6,-20.3],
  RW:[29.9,-1.9],CD:[24.0,-3.0],CG:[15.8,-0.2],GA:[11.6,-0.8],
  GN:[-11.7,11.0],ML:[-2.0,17.6],BF:[-1.6,12.4],NE:[8.1,17.6],
  TD:[18.7,15.5],KE:[37.9,0.0],MZ:[35.5,-18.7],AO:[17.9,-11.2],
  MG:[46.9,-20.3],SD:[29.7,12.9],LY:[17.2,26.3],SA:[45.1,23.9],
  YE:[48.5,15.5],IQ:[43.7,33.2],IR:[53.7,32.4],UZ:[63.0,41.4],
  KZ:[66.9,48.0],MN:[103.8,46.9],TW:[120.9,23.7],VU:[167.0,-16.0],
}

const GEO_NAMES: Record<string, string> = {
  FR:'France',US:'États-Unis',CA:'Canada',GB:'Royaume-Uni',
  DE:'Allemagne',BE:'Belgique',CH:'Suisse',NL:'Pays-Bas',
  ES:'Espagne',IT:'Italie',PT:'Portugal',AU:'Australie',
  BR:'Brésil',MX:'Mexique',JP:'Japon',KR:'Corée du Sud',
  AR:'Argentine',MA:'Maroc',SN:'Sénégal',CI:"Côte d'Ivoire",
  ZA:'Afrique du Sud',NG:'Nigéria',RU:'Russie',CN:'Chine',
  IN:'Inde',SE:'Suède',NO:'Norvège',DK:'Danemark',
  PL:'Pologne',AT:'Autriche',LU:'Luxembourg',MC:'Monaco',
  DZ:'Algérie',TN:'Tunisie',CM:'Cameroun',SG:'Singapour',
  HK:'Hong Kong',AE:'Émirats arabes unis',IL:'Israël',TR:'Turquie',
  PK:'Pakistan',BD:'Bangladesh',TH:'Thaïlande',VN:'Viêt Nam',
  MY:'Malaisie',ID:'Indonésie',PH:'Philippines',NZ:'Nouvelle-Zélande',
  GH:'Ghana',EG:'Égypte',ET:'Éthiopie',TZ:'Tanzanie',
  UA:'Ukraine',CZ:'République tchèque',RO:'Roumanie',HU:'Hongrie',
  FI:'Finlande',SK:'Slovaquie',HR:'Croatie',BG:'Bulgarie',
  CL:'Chili',CO:'Colombie',PE:'Pérou',VE:'Venezuela',
  LT:'Lituanie',LV:'Lettonie',EE:'Estonie',RS:'Serbie',
  GR:'Grèce',CY:'Chypre',IE:'Irlande',
  HT:'Haïti',RE:'Réunion',GP:'Guadeloupe',MQ:'Martinique',
  GF:'Guyane française',NC:'Nouvelle-Calédonie',PF:'Polynésie française',
  MU:'Maurice',RW:'Rwanda',CD:'RD Congo',CG:'Congo',
  GA:'Gabon',GN:'Guinée',ML:'Mali',BF:'Burkina Faso',NE:'Niger',
  TD:'Tchad',KE:'Kenya',MZ:'Mozambique',AO:'Angola',
  MG:'Madagascar',SD:'Soudan',LY:'Libye',SA:'Arabie saoudite',
  YE:'Yémen',IQ:'Irak',IR:'Iran',UZ:'Ouzbékistan',
  KZ:'Kazakhstan',MN:'Mongolie',TW:'Taïwan',VU:'Vanuatu',
}

function geoFlag(code: string): string {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

type GeoUser = { user_id: string; email: string; display_name: string; created_at: string; last_sign_in_at: string | null }

type GeoPeriod = 'live' | '7' | '30' | 'all'
const GEO_PERIODS: { key: GeoPeriod; label: string; dot?: boolean }[] = [
  { key: 'live', label: 'En direct', dot: true },
  { key: '7',    label: '7 derniers jours' },
  { key: '30',   label: '30 derniers jours' },
  { key: 'all',  label: 'Toujours' },
]
const GEO_MINUTES: Partial<Record<GeoPeriod, number>> = {
  live: 15,
  '7':  7  * 24 * 60,
  '30': 30 * 24 * 60,
}

function GeoSection({ token, isMobile }: { token: string; isMobile: boolean }) {
  const [period, setPeriod]     = useState<GeoPeriod>('all')
  const [geoCntrs, setGeoCntrs] = useState<{ code: string; visitors: number }[]>([])
  const [geoLoad, setGeoLoad]   = useState(false)
  const [geoHov, setGeoHov]     = useState<{ code: string; visitors: number } | null>(null)
  // drilldown
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [userList, setUserList]         = useState<GeoUser[]>([])
  const [userLoad, setUserLoad]         = useState(false)

  // Auto-refresh toutes les 30s en mode "En direct"
  useEffect(() => {
    if (period !== 'live') return
    const iv = setInterval(() => {
      fetch(`/api/admin/geo?minutes=15`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(({ countries }) => setGeoCntrs(countries ?? []))
        .catch(() => {})
    }, 30000)
    return () => clearInterval(iv)
  }, [period, token])

  useEffect(() => {
    setGeoLoad(true)
    setExpanded(null)
    const minutes = GEO_MINUTES[period]
    const url = minutes ? `/api/admin/geo?minutes=${minutes}` : '/api/admin/geo'
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ countries }) => setGeoCntrs(countries ?? []))
      .catch(() => {})
      .finally(() => setGeoLoad(false))
  }, [token, period])

  function toggleCountry(code: string) {
    if (expanded === code) { setExpanded(null); return }
    setExpanded(code)
    setUserList([])
    setUserLoad(true)
    const minutes = GEO_MINUTES[period]
    const url = minutes
      ? `/api/admin/users-geo?country=${code}&minutes=${minutes}`
      : `/api/admin/users-geo?country=${code}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ users }) => setUserList(users ?? []))
      .catch(() => {})
      .finally(() => setUserLoad(false))
  }

  const top10  = geoCntrs.slice(0, 10)
  const topMax = top10.length ? Math.max(...top10.map(c => c.visitors)) : 1

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '20px 24px' }}>
      {/* Filtres période */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {GEO_PERIODS.map(p => {
          const isLive = p.key === 'live'
          const active = period === p.key
          return (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${active ? (isLive ? '#22c55e' : ACCENT) : '#e2e8f0'}`,
              background: active ? (isLive ? '#22c55e' : ACCENT) : '#fff',
              color: active ? '#fff' : '#64748b',
              fontWeight: active ? 600 : 400, transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isLive && (
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: active ? '#fff' : '#22c55e',
                  animation: active ? 'livePulse 2s ease-in-out infinite' : 'none',
                }} />
              )}
              {p.label}
            </button>
          )
        })}
      </div>

      {geoLoad && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>Chargement…</div>}

      {!geoLoad && geoCntrs.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>
          Aucune donnée — les comptes seront localisés à mesure des connexions.
        </div>
      )}

      {geoCntrs.length > 0 && (
        <>
          <div style={{ position: 'relative', marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}>
            <GeoMap geoCntrs={geoCntrs} centroids={GEO_CENTROIDS} onHover={setGeoHov} />
            {geoHov && (
              <div style={{
                position: 'absolute', top: 10, left: 10, pointerEvents: 'none',
                background: '#0f172a', color: '#fff', padding: '8px 14px',
                borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>{geoFlag(geoHov.code)}</span>
                <span style={{ fontWeight: 600 }}>{GEO_NAMES[geoHov.code] ?? geoHov.code}</span>
                <span style={{ color: '#93c5fd', marginLeft: 4, fontWeight: 700 }}>{fmt(geoHov.visitors)}</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>comptes</span>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(255,255,255,0.88)', borderRadius: 6, padding: '3px 10px',
              fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(0,61,166,0.4)', border: '1.5px solid rgba(0,40,140,0.65)', flexShrink: 0 }} />
              Comptes utilisateurs — taille proportionnelle au volume
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Top {top10.length} pays · cliquer pour voir les comptes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {top10.map(({ code, visitors }, i) => (
              <div key={code}>
                <button
                  onClick={() => toggleCountry(code)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    background: expanded === code ? '#eff6ff' : 'transparent',
                    border: 'none', borderRadius: 8, padding: '7px 8px', cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                >
                  <div style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{geoFlag(code)}</div>
                  <div style={{ width: isMobile ? 90 : 130, fontSize: 12, color: '#334155', fontWeight: 500, flexShrink: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {GEO_NAMES[code] ?? code}
                  </div>
                  <div style={{ flex: 1, height: 6, borderRadius: 6, background: '#f1f5f9', minWidth: 40 }}>
                    <div style={{ height: '100%', borderRadius: 6, background: ACCENT, width: `${(visitors / topMax) * 100}%`, opacity: Math.max(0.35, 1 - i * 0.07) }} />
                  </div>
                  <div style={{ width: 50, textAlign: 'right', fontSize: 13, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{fmt(visitors)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{expanded === code ? '▲' : '▼'}</div>
                </button>

                {expanded === code && (
                  <div style={{ margin: '4px 8px 8px 36px', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    {userLoad && (
                      <div style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>Chargement…</div>
                    )}
                    {!userLoad && userList.length === 0 && (
                      <div style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>Aucun compte trouvé.</div>
                    )}
                    {!userLoad && userList.map(u => (
                      <div key={u.user_id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 14px', borderBottom: '1px solid #f1f5f9',
                        fontSize: 12,
                      }}>
                        <div style={{ fontWeight: 600, color: '#334155', minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.display_name}
                        </div>
                        <div style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('fr-FR') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
            {fmt(geoCntrs.reduce((s, c) => s + c.visitors, 0))} comptes
            {period === 'live' ? ' actifs maintenant (15 min)' : period === '7' ? ' actifs 7j' : period === '30' ? ' actifs 30j' : ' localisés'}
            {' · '}{geoCntrs.length} pays
            {period === 'live' && <span style={{ marginLeft: 8, color: '#22c55e' }}>↻ 30s</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ── En direct ─────────────────────────────────────────────────────────────

type LiveCounts = { m5: number; m15: number; h1: number; today: number }
type LiveView   = { path: string; country: string; created_at: string }

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5)  return 'à l\'instant'
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  return `il y a ${Math.floor(m / 60)}h`
}

function LiveSection({ token }: { token: string }) {
  const [counts, setCounts]   = useState<LiveCounts | null>(null)
  const [recent, setRecent]   = useState<LiveView[]>([])
  const [lastUp, setLastUp]   = useState<Date | null>(null)
  const [, setTick]           = useState(0)

  const fetchLive = useCallback(() => {
    fetch('/api/admin/live', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ counts, recent }) => {
        setCounts(counts)
        setRecent(recent ?? [])
        setLastUp(new Date())
      })
      .catch(() => {})
  }, [token])

  useEffect(() => { fetchLive() }, [fetchLive])

  // Auto-refresh toutes les 15s
  useEffect(() => {
    const iv = setInterval(fetchLive, 15000)
    return () => clearInterval(iv)
  }, [fetchLive])

  // Tick toutes les 5s pour mettre à jour les "il y a Xs"
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(iv)
  }, [])

  const WINDOWS = [
    { key: 'm5'  as const, label: '5 min',   color: '#ef4444' },
    { key: 'm15' as const, label: '15 min',  color: '#f59e0b' },
    { key: 'h1'  as const, label: '1 heure', color: '#0ea5e9' },
    { key: 'today' as const, label: "Auj.", color: ACCENT    },
  ]

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 0 0 rgba(34,197,94,0.5)',
            animation: 'livePulse 2s ease-in-out infinite',
          }} />
          <style>{`@keyframes livePulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)} 50%{box-shadow:0 0 0 7px rgba(34,197,94,0)} }`}</style>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>En direct</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>pages vues · auto-refresh 15s</span>
        </div>
        {lastUp && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            Mis à jour {lastUp.toLocaleTimeString('fr-FR')}
          </span>
        )}
      </div>

      {/* Compteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
        {WINDOWS.map(w => (
          <div key={w.key} style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, fontWeight: 500 }}>{w.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: w.color, lineHeight: 1 }}>
              {counts ? counts[w.key] : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {recent.length === 0 && (
          <div style={{ padding: '20px 20px', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
            Aucune page vue récente — la table page_views doit être créée.
          </div>
        )}
        {recent.map((v, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px',
            borderBottom: '1px solid #f8fafc', fontSize: 12,
          }}>
            <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{geoFlag(v.country || 'XX')}</span>
            <span style={{ flex: 1, color: '#334155', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.path}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 10, flexShrink: 0 }}>{relTime(v.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Historique mensuel ────────────────────────────────────────────────────

type Snapshot = { day: string; total_users: number; total_cards: number; active_users: number; total_scans: number }

const MONTHS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTHS_FR[parseInt(m, 10) - 1]} ${y}`
}

function DeltaCell({ cur, prev }: { cur: number; prev: number | undefined }) {
  if (prev == null) return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
  const diff = cur - prev
  const pct  = prev > 0 ? ((diff / prev) * 100).toFixed(0) : null
  if (diff === 0) return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
  const color = diff > 0 ? '#059669' : '#ef4444'
  return (
    <span style={{ fontSize: 11, color, fontWeight: 500 }}>
      {diff > 0 ? '+' : ''}{fmt(diff)}{pct ? ` (${diff > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  )
}

function HistorySection({ token, isMobile }: { token: string; isMobile: boolean }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/history', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ snapshots: s }) => setSnapshots(s ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  // Prend le dernier snapshot (le plus récent) de chaque mois — les données viennent en DESC
  const byMonth: Record<string, Snapshot> = {}
  for (const s of snapshots) {
    const month = s.day.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = s
  }
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]))

  if (loading) return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, color: '#94a3b8', fontSize: 13 }}>
      Chargement…
    </div>
  )

  if (months.length === 0) return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, color: '#94a3b8', fontSize: 13 }}>
      Pas encore de données — recharger cette page demain pour voir l'historique.
    </div>
  )

  const colStyle = (right = false): CSSProperties => ({
    padding: isMobile ? '9px 10px' : '10px 16px',
    textAlign: right ? 'right' : 'left',
    fontSize: 12,
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', minWidth: 560 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: ACCENT }}>
              <th style={{ ...colStyle(), color: '#fff', fontWeight: 600 }}>Mois</th>
              <th style={{ ...colStyle(true), color: '#fff', fontWeight: 600 }}>Inscrits</th>
              <th style={{ ...colStyle(true), color: '#d1d5db', fontWeight: 500, fontSize: 11 }}>évol.</th>
              <th style={{ ...colStyle(true), color: '#fff', fontWeight: 600 }}>Cartes</th>
              <th style={{ ...colStyle(true), color: '#d1d5db', fontWeight: 500, fontSize: 11 }}>évol.</th>
              <th style={{ ...colStyle(true), color: '#fff', fontWeight: 600 }}>Actifs/mois</th>
              <th style={{ ...colStyle(true), color: '#fff', fontWeight: 600 }}>Scans</th>
            </tr>
          </thead>
          <tbody>
            {months.map(([ym, snap], i) => {
              const prev   = months[i + 1]?.[1]
              const isLast = i === months.length - 1
              return (
                <tr key={ym} style={{
                  background: i % 2 === 0 ? '#fff' : '#f8fafc',
                  borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                }}>
                  <td style={{ ...colStyle(), fontWeight: 600, color: '#334155' }}>{fmtMonth(ym)}</td>
                  <td style={{ ...colStyle(true), fontWeight: 700, color: ACCENT }}>{fmt(snap.total_users)}</td>
                  <td style={{ ...colStyle(true) }}>
                    <DeltaCell cur={snap.total_users} prev={prev?.total_users} />
                  </td>
                  <td style={{ ...colStyle(true), fontWeight: 700, color: '#059669' }}>{fmt(snap.total_cards)}</td>
                  <td style={{ ...colStyle(true) }}>
                    <DeltaCell cur={snap.total_cards} prev={prev?.total_cards} />
                  </td>
                  <td style={{ ...colStyle(true), fontWeight: 600, color: '#8b5cf6' }}>{fmt(snap.active_users)}</td>
                  <td style={{ ...colStyle(true), fontWeight: 600, color: '#64748b' }}>{fmt(snap.total_scans)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '8px 16px', fontSize: 10, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
          Snapshot quotidien · valeur du dernier jour enregistré par mois
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────

export default function AdminStats() {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [isMobile, setIsMobile]   = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Non connecté'); setLoading(false); return }
      setSessionToken(session.access_token)
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
  const cardSub     = stats.total_cards_manual != null
    ? `dont ${fmt(stats.total_cards_manual)} manuelles`
    : undefined
  const userAvg = safeAvg(stats.total_users, stats.oldest_user)
  const cardAvg = safeAvg(manualCards, stats.oldest_card || stats.oldest_user)

  const cp = isMobile ? '16px' : '24px 28px'
  const hs = healthScore(stats)

  function exportCsv() {
    if (!stats) return
    const rows: [string, string][] = [
      ['Métrique', 'Valeur'],
      ['Inscrits total', String(stats.total_users)],
      ['Cartes manuelles', String(stats.total_cards_manual ?? 0)],
      ['DAU', String(stats.dau ?? 0)],
      ['MAU', String(stats.active_users_month)],
      ['DAU/MAU', `${((( stats.dau ?? 0) / Math.max(1, stats.active_users_month)) * 100).toFixed(1)} %`],
      ['Actifs semaine', String(stats.active_users_week)],
      ['Rétention D7', stats.retention_d7_base ? `${((stats.retention_d7_count / stats.retention_d7_base) * 100).toFixed(1)} %` : '—'],
      ['Rétention D30', stats.retention_d30_base ? `${((stats.retention_d30_count / stats.retention_d30_base) * 100).toFixed(1)} %` : '—'],
      ['Churn M-1→M', stats.churn_base ? `${((stats.churn_count / stats.churn_base) * 100).toFixed(1)} %` : '—'],
      ['Délai activation médian (j)', stats.activation_delay_median != null ? String(stats.activation_delay_median) : '—'],
      ['Cartes/utilisateur actif', ((stats.total_cards_manual ?? 0) / Math.max(1, stats.active_users_month)).toFixed(1)],
      ['Scans total', String(stats.total_scans ?? 0)],
      ['Coût Gemini 2.5 Flash (€)', (stats.estimated_cost_eur ?? 0).toFixed(4)],
      ['Taux correction Gemini', stats.scan_total_training ? `${((stats.scan_corrected_count / stats.scan_total_training) * 100).toFixed(1)} %` : '—'],
      ['Complétude fiches', stats.avg_card_completeness != null ? `${stats.avg_card_completeness} %` : '—'],
      ['Donateurs', String(stats.donor_count ?? 0)],
      ['Classeurs', String(stats.total_binders ?? 0)],
      ['Trades proposés', String(stats.total_trade_offers ?? 0)],
      ['Health score', String(hs.score)],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `memorabilius_stats_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: isMobile ? '20px 12px' : '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 20 : 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#0f172a' }}>Panel Admin</h1>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {updatedAt ? `Mis à jour ${updatedAt.toLocaleTimeString('fr-FR')}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportCsv} style={{
              background: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Export CSV
            </button>
            <button onClick={load} style={{
              background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Actualiser
            </button>
          </div>
        </div>

        {/* Health Score */}
        <div style={{
          background: '#fff', border: `2px solid ${hs.color}22`, borderRadius: 14,
          padding: isMobile ? 16 : '20px 28px', marginBottom: isMobile ? 20 : 32,
          display: 'flex', flexWrap: 'wrap', gap: isMobile ? 16 : 32, alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Health Score</div>
            <div style={{ fontSize: 52, fontWeight: 900, color: hs.color, lineHeight: 1 }}>{hs.score}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: hs.color, marginTop: 4 }}>{hs.grade}</div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hs.components.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b', width: 90, flexShrink: 0 }}>{c.label}</div>
                  <div style={{ flex: 1, height: 5, borderRadius: 5, background: '#f1f5f9' }}>
                    <div style={{
                      height: '100%', borderRadius: 5,
                      background: c.score >= 80 ? '#059669' : c.score >= 60 ? '#0ea5e9' : c.score >= 40 ? '#f59e0b' : '#ef4444',
                      width: `${c.score}%`, transition: 'width .6s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', width: 44, textAlign: 'right' }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', width: 28, textAlign: 'right' }}>{c.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <KpiCard label="Inscrits total"         value={stats.total_users} />
          <KpiCard label="Cartes total"            value={stats.total_cards} sub={cardSub} />
          <KpiCard label="Nouveaux inscrits auj."  value={stats.today_users} />
          <KpiCard label="Cartes ajoutées auj."    value={stats.today_cards} />
        </div>

        {/* En direct */}
        <SectionTitle>En direct</SectionTitle>
        <div style={{ marginBottom: isMobile ? 20 : 32 }}>
          {sessionToken && <LiveSection token={sessionToken} />}
        </div>

        {/* 7 derniers jours */}
        {stats.last_7_days && (
          <>
            <SectionTitle>7 derniers jours</SectionTitle>
            <div style={{ marginBottom: isMobile ? 20 : 32 }}>
              <Last7DaysTable data={stats.last_7_days} />
            </div>
          </>
        )}

        {/* Historique mensuel */}
        <SectionTitle>Historique mensuel</SectionTitle>
        <div style={{ marginBottom: isMobile ? 20 : 32 }}>
          {sessionToken && <HistorySection token={sessionToken} isMobile={isMobile} />}
        </div>

        {/* Géographie */}
        <SectionTitle>Géographie</SectionTitle>
        <div style={{ marginBottom: isMobile ? 20 : 32 }}>
          {sessionToken && <GeoSection token={sessionToken} isMobile={isMobile} />}
        </div>

        {/* Croissance cumulée */}
        <SectionTitle>Croissance cumulée</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: cp }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Utilisateurs totaux</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{fmt(stats.total_users)}</div>
            </div>
            <CumulativeChart data={stats.user_daily} totalToday={stats.total_users} color={ACCENT} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: cp }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Cartes totales</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmt(stats.total_cards)}</div>
            </div>
            <CumulativeChart data={stats.card_daily} totalToday={stats.total_cards} color="#059669" />
          </div>
        </div>

        {/* Activité journalière */}
        <SectionTitle>Activité journalière</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: cp }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 16 }}>Inscriptions / jour</div>
            <DailyChart data={stats.user_daily} color={ACCENT} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: cp }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>Cartes ajoutées / jour</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>scanner seulement</div>
            </div>
            <DailyChart data={stats.card_daily} color="#059669" />
          </div>
        </div>

        {/* Tableaux stats */}
        <SectionTitle>Statistiques détaillées</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
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

        {/* Utilisateurs actifs + DAU */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '20px 24px', marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 14 }}>
            Utilisateurs actifs (au moins 1 carte ajoutée)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 20 : 48 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>DAU (auj.)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>{fmt(stats.dau ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Cette semaine</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>{fmt(stats.active_users_week)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Ce mois (MAU)</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>{fmt(stats.active_users_month)}</div>
                {stats.prev_mau ? <Delta cur={stats.active_users_month} prev={stats.prev_mau} /> : null}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>DAU / MAU</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>
                {stats.active_users_month ? `${(((stats.dau ?? 0) / stats.active_users_month) * 100).toFixed(1)} %` : '—'}
              </div>
              <Bench value={stats.active_users_month ? (stats.dau ?? 0) / stats.active_users_month : 0} good={0.20} ok={0.10} label="DAU/MAU" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Actifs / inscrits</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>
                {stats.total_users ? `${((stats.active_users_month / stats.total_users) * 100).toFixed(1)} %` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Cartes / actif</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>
                {((stats.total_cards_manual ?? 0) / Math.max(1, stats.active_users_month)).toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Délai d'activation */}
        {stats.activation_delay_median != null && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '16px 24px', marginBottom: isMobile ? 20 : 32, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Délai médian d'activation</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: Number(stats.activation_delay_median) <= 1 ? '#059669' : Number(stats.activation_delay_median) <= 3 ? '#f59e0b' : '#ef4444', marginTop: 2 }}>
                {stats.activation_delay_median} jour{Number(stats.activation_delay_median) > 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', maxWidth: 360 }}>
              Temps médian entre inscription et ajout de la 1ère carte.
              <span style={{ color: Number(stats.activation_delay_median) <= 1 ? '#059669' : Number(stats.activation_delay_median) <= 3 ? '#f59e0b' : '#ef4444', fontWeight: 600, marginLeft: 4 }}>
                {Number(stats.activation_delay_median) <= 1 ? 'Excellent — les utilisateurs comprennent la valeur immédiatement.' : Number(stats.activation_delay_median) <= 3 ? 'Correct — quelques jours de réflexion.' : 'Élevé — risque de perte d\'intérêt avant activation.'}
              </span>
            </div>
          </div>
        )}

        {/* Funnel d'activation */}
        <SectionTitle>Funnel d'activation</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '24px 28px', marginBottom: isMobile ? 20 : 32 }}>
          {(() => {
            // Ordre logique : inscrits → 1ère carte (toute source) → scanneurs → actifs D7
            const steps = [
              { label: 'Inscrits',           value: stats.funnel_registered ?? stats.total_users, color: ACCENT,    note: '' },
              { label: '1ère carte ajoutée', value: stats.funnel_first_card ?? 0,                color: '#8b5cf6', note: 'scanner + manuel' },
              { label: 'Ont scanné',         value: stats.funnel_scanned ?? 0,                   color: '#0ea5e9', note: 'via scanner IA' },
              { label: 'Actifs D7',          value: stats.retention_d7_count ?? 0,               color: '#059669', note: 'carte dans les 7j' },
            ]
            const max = steps[0].value || 1
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {steps.map((s, i) => {
                  const pct     = ((s.value / max) * 100).toFixed(1)
                  const prev    = steps[i - 1]
                  const diff    = prev ? s.value - prev.value : null
                  const dropPct = prev ? ((prev.value - s.value) / Math.max(1, prev.value) * 100) : null
                  const isGain  = diff !== null && diff > 0
                  return (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{s.label}</span>
                          {s.note && <span style={{ fontSize: 10, color: '#94a3b8' }}>({s.note})</span>}
                          {dropPct !== null && !isGain && Number(dropPct) > 0.5 && (
                            <span style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', borderRadius: 4, padding: '1px 6px' }}>
                              −{dropPct.toFixed(0)} %
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: s.color }}>{fmt(s.value)}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{pct} %</span>
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 6, background: '#f1f5f9' }}>
                        <div style={{ height: '100%', borderRadius: 6, background: s.color, width: `${pct}%`, transition: 'width .6s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Rétention & churn */}
        <SectionTitle>Rétention & Churn</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          {/* D7 */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Rétention D7</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
              {stats.retention_d7_base ? `${((stats.retention_d7_count / stats.retention_d7_base) * 100).toFixed(1)} %` : '—'}
              {stats.prev_retention_d7_base ? (
                <Delta
                  cur={stats.retention_d7_count / Math.max(1, stats.retention_d7_base)}
                  prev={stats.prev_retention_d7_count / Math.max(1, stats.prev_retention_d7_base)}
                />
              ) : null}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{fmt(stats.retention_d7_count ?? 0)} / {fmt(stats.retention_d7_base ?? 0)} inscrits</div>
            <Bench value={stats.retention_d7_base ? stats.retention_d7_count / stats.retention_d7_base : 0} good={0.40} ok={0.25} label="D7" />
          </div>
          {/* D30 */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Rétention D30</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
              {stats.retention_d30_base ? `${((stats.retention_d30_count / stats.retention_d30_base) * 100).toFixed(1)} %` : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{fmt(stats.retention_d30_count ?? 0)} / {fmt(stats.retention_d30_base ?? 0)} inscrits</div>
            <Bench value={stats.retention_d30_base ? stats.retention_d30_count / stats.retention_d30_base : 0} good={0.20} ok={0.10} label="D30" />
          </div>
          {/* Churn */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Churn M-1 → M</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
              {stats.churn_base ? `${((stats.churn_count / stats.churn_base) * 100).toFixed(1)} %` : '—'}
              {stats.prev_churn_base ? (
                <Delta
                  cur={stats.churn_count / Math.max(1, stats.churn_base)}
                  prev={stats.prev_churn_count / Math.max(1, stats.prev_churn_base)}
                  invert
                />
              ) : null}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{fmt(stats.churn_count ?? 0)} partis sur {fmt(stats.churn_base ?? 0)}</div>
            <Bench value={stats.churn_base ? stats.churn_count / stats.churn_base : 0} good={0.15} ok={0.25} label="Churn" invert />
          </div>
          {/* Donateurs */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Donateurs</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{fmt(stats.donor_count ?? 0)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              {stats.total_users ? `${(((stats.donor_count ?? 0) / stats.total_users) * 100).toFixed(1)} % des inscrits` : ''}
            </div>
          </div>
        </div>

        {/* IA / Coûts Gemini */}
        <SectionTitle>IA & Coûts Gemini</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <KpiCard label="Scans total"        value={stats.total_scans ?? 0} />
          <KpiCard label="Scans aujourd'hui"  value={stats.scans_today ?? 0} />
          <KpiCard label="Scans ce mois"      value={stats.scans_month ?? 0} />
          <KpiCard label="Coût total"         value={`€ ${(stats.estimated_cost_eur ?? 0).toFixed(4)}`} sub="Gemini 2.5 Flash · €0,00013/scan" />
          <KpiCard label="Coût ce mois"       value={`€ ${(stats.cost_month_eur ?? 0).toFixed(4)}`} sub="mois calendaire en cours" />
        </div>

        {/* Qualité IA — taux de correction */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '20px 24px', marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>Taux de correction Gemini</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stats.scan_total_training && (stats.scan_corrected_count / stats.scan_total_training) > 0.2 ? '#ef4444' : '#059669' }}>
                {stats.scan_total_training
                  ? `${((stats.scan_corrected_count / stats.scan_total_training) * 100).toFixed(1)} %`
                  : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {fmt(stats.scan_corrected_count ?? 0)} corrigés / {fmt(stats.scan_total_training ?? 0)} scans entraînement
              </div>
            </div>
            {(stats.top_corrected_fields ?? []).length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 500 }}>Champs les plus corrigés</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {stats.top_corrected_fields.map((f, i) => {
                    const maxCount = stats.top_corrected_fields[0]?.count || 1
                    return (
                      <div key={f.field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, color: '#334155', width: 90, flexShrink: 0 }}>{f.field}</div>
                        <div style={{ flex: 1, height: 6, borderRadius: 6, background: '#f1f5f9' }}>
                          <div style={{ height: '100%', borderRadius: 6, background: '#f59e0b', width: `${(f.count / maxCount) * 100}%`, transition: 'width .5s' }} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', width: 30, textAlign: 'right' }}>{f.count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Qualité collection */}
        <SectionTitle>Qualité des cartes</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '20px 24px', marginBottom: isMobile ? 10 : 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 16 }}>
            {[
              { label: 'Avec photo',  value: stats.cards_with_photo ?? 0,  color: '#0ea5e9' },
              { label: 'RC',          value: stats.cards_with_rc    ?? 0,  color: '#f59e0b' },
              { label: 'Auto',        value: stats.cards_with_auto  ?? 0,  color: '#8b5cf6' },
              { label: 'Patch',       value: stats.cards_with_patch ?? 0,  color: '#ec4899' },
              { label: 'Numérotées',  value: stats.cards_with_num   ?? 0,  color: '#059669' },
            ].map(({ label, value, color }) => {
              const total = stats.total_cards_manual ?? 1
              const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
              return (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{fmt(value)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{pct} %</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${Math.min(100, Number(pct))}%`, transition: 'width .5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Complétude + Top marques */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 16 : '20px 24px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Complétude moyenne des fiches</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
              {stats.avg_card_completeness != null ? `${stats.avg_card_completeness} %` : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>sur 6 champs clés : nom, année, marque, collection, équipe, photo</div>
            {stats.avg_card_completeness != null && (
              <div style={{ marginTop: 12, height: 8, borderRadius: 8, background: '#f1f5f9' }}>
                <div style={{ height: '100%', borderRadius: 8, background: ACCENT, width: `${stats.avg_card_completeness}%`, transition: 'width .6s' }} />
              </div>
            )}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13, color: '#334155' }}>Top 5 marques</div>
            {(stats.top_marques ?? []).map((m, i) => {
              const maxC = stats.top_marques?.[0]?.count || 1
              return (
                <div key={m.marque} style={{ padding: '9px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, color: '#334155', width: 90, flexShrink: 0, fontWeight: 500 }}>{m.marque}</div>
                  <div style={{ flex: 1, height: 5, borderRadius: 5, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', borderRadius: 5, background: ACCENT, opacity: 0.7 - i * 0.1, width: `${(m.count / maxC) * 100}%`, transition: 'width .5s' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, width: 40, textAlign: 'right' }}>{fmt(m.count)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Engagement */}
        <SectionTitle>Engagement</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
          <KpiCard label="Classeurs créés"    value={stats.total_binders ?? 0} />
          <KpiCard label="Trades proposés"    value={stats.total_trade_offers ?? 0} />
          <KpiCard label="Trades acceptés"    value={stats.trade_offers_accepted ?? 0} />
          <KpiCard label="Trades en attente"  value={stats.trade_offers_pending ?? 0}
            sub={stats.total_trade_offers ? `${(((stats.trade_offers_accepted ?? 0) / stats.total_trade_offers) * 100).toFixed(0)}% d'acceptation` : undefined}
          />
        </div>

        {/* Top utilisateurs */}
        <SectionTitle>Top utilisateurs</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: isMobile ? 20 : 32 }}>
          <div style={{ padding: '14px 20px', background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 14 }}>
            Top 10 — nombre de cartes
          </div>
          {(stats.top_users ?? []).map((u, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '11px 20px',
              borderBottom: '1px solid #f1f5f9', gap: 12,
            }}>
              <div style={{ width: 24, textAlign: 'center', fontWeight: 700, color: i < 3 ? ['#f59e0b','#94a3b8','#b45309'][i] : '#cbd5e1', fontSize: 13 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155', fontWeight: 500 }}>{u.name}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: ACCENT }}>{fmt(u.cards)}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
