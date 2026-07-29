'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT = '#003DA6'

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
  total_cards_manual: number
  today_cards: number
  week_cards: number
  month_cards: number
  oldest_card: string
  active_users_week: number
  active_users_month: number
  user_daily: DailyPoint[]
  card_daily: DailyPoint[]
}

function fmt(n: number) {
  return n?.toLocaleString('fr-FR') ?? '—'
}

function avg(total: number, oldest: string) {
  const days = Math.max(1, Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000))
  return {
    day: (total / days).toFixed(1),
    week: (total / (days / 7)).toFixed(1),
    month: (total / (days / 30)).toFixed(1),
  }
}

// ── Graphique interactif — historique complet + projection 1 an ───────────

function InteractiveChart({ data, color }: { data: DailyPoint[]; color: string }) {
  const [zoom, setZoom]       = useState<Zoom>('3m')
  const [hovered, setHovered] = useState<number | null>(null)

  // Toutes les données depuis le premier jour
  const dataMap = new Map(data.map(p => [p.day.slice(0, 10), p.count]))
  const today   = new Date()
  const earliest = data.length > 0
    ? data.reduce((min, p) => p.day.slice(0, 10) < min ? p.day.slice(0, 10) : min, data[0].day.slice(0, 10))
    : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const filledAll: DailyPoint[] = []
  const cur = new Date(earliest + 'T12:00:00Z')
  while (cur <= today) {
    const day = cur.toISOString().slice(0, 10)
    filledAll.push({ day, count: dataMap.get(day) ?? 0 })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  const nAll = filledAll.length

  // Régression linéaire sur tout l'historique
  const ys    = filledAll.map(p => p.count)
  const sumX  = (nAll * (nAll - 1)) / 2
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = ys.reduce((s, y, i) => s + i * y, 0)
  const sumX2 = ((nAll - 1) * nAll * (2 * nAll - 1)) / 6
  const denom = nAll * sumX2 - sumX * sumX
  const slope     = denom === 0 ? 0 : (nAll * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / nAll

  // Projection 365 jours
  const projAll: DailyPoint[] = Array.from({ length: 365 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + i + 1)
    return { day: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(intercept + slope * (nAll + i))) }
  })

  // Fenêtre zoom
  const { histDays, projDays } = ZOOM_CFG[zoom]
  const visHist  = histDays === Infinity ? filledAll : filledAll.slice(-histDays)
  const visProj  = projAll.slice(0, projDays)
  const nVis     = visHist.length
  const allVis   = [...visHist, ...visProj]
  const T        = allVis.length
  const maxVal   = Math.max(1, ...allVis.map(p => p.count))

  // SVG
  const W = 680, H = 160
  const PL = 50, PR = 12, PT = 20, PB = 28
  const cW = W - PL - PR, cH = H - PT - PB

  const sx = (i: number) => PL + (i / Math.max(1, T - 1)) * cW
  const sy = (v: number) => PT + cH - Math.max(0, (v / maxVal) * cH)

  const hPath = visHist.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')
  const hArea = nVis > 1
    ? `${hPath}L${sx(nVis - 1).toFixed(1)},${(PT + cH).toFixed(1)}L${sx(0).toFixed(1)},${(PT + cH).toFixed(1)}Z`
    : ''
  const pPath = [visHist[nVis - 1], ...visProj]
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(nVis - 1 + i).toFixed(1)},${sy(p.count).toFixed(1)}`).join('')

  const yTicks = [0, Math.round(maxVal * 0.5), maxVal]

  // Labels X : 5 positions régulières
  const nLabels = Math.min(5, T)
  const labelIdx = Array.from({ length: nLabels }, (_, i) =>
    Math.round(i * (T - 1) / Math.max(1, nLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (W / rect.width)
    const idx = Math.round(((mouseX - PL) / cW) * (T - 1))
    setHovered(Math.max(0, Math.min(T - 1, idx)))
  }

  const hp     = hovered !== null ? allVis[hovered] : null
  const hx     = hovered !== null ? sx(hovered) : null
  const hy     = hp ? sy(hp.count) : null
  const isProj = hovered !== null && hovered >= nVis

  const trendLabel = Math.abs(slope) < 0.5 ? '→ stable'
    : slope > 0 ? `↑ +${slope.toFixed(1)}/j` : `↓ ${slope.toFixed(1)}/j`
  const projEnd = projAll[projAll.length - 1]?.count ?? 0

  const tooltipPct   = hx !== null ? (hx / W) * 100 : 50
  const tooltipXform = tooltipPct < 12 ? 'translateX(0)' : tooltipPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Boutons zoom */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginBottom: 8 }}>
        {(Object.keys(ZOOM_CFG) as Zoom[]).map(z => (
          <button
            key={z}
            onClick={() => { setZoom(z); setHovered(null) }}
            style={{
              padding: '3px 9px', fontSize: 11, borderRadius: 6,
              border: `1px solid ${zoom === z ? color : '#e2e8f0'}`,
              background: zoom === z ? color : '#fff',
              color: zoom === z ? '#fff' : '#64748b',
              cursor: 'pointer', fontWeight: zoom === z ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            {ZOOM_CFG[z].label}
          </button>
        ))}
      </div>

      {/* Zone graphique */}
      <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
        >
          {/* Grille Y */}
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL - 5} y={sy(t) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                {t >= 10000 ? `${(t / 1000).toFixed(0)}k` : t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
              </text>
            </g>
          ))}

          {/* Fond zone projection */}
          <rect
            x={sx(nVis - 1)} y={PT}
            width={Math.max(0, sx(T - 1) - sx(nVis - 1))}
            height={cH}
            fill="#f1f5f9" opacity={0.6}
          />

          {/* Area historique */}
          {hArea && <path d={hArea} fill={color} opacity={0.09} />}

          {/* Ligne historique */}
          {nVis > 1 && (
            <path d={hPath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Ligne projection */}
          <path d={pPath} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.4} strokeLinejoin="round" />

          {/* Séparateur aujourd'hui */}
          <line x1={sx(nVis - 1)} x2={sx(nVis - 1)} y1={PT} y2={PT + cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(nVis - 1)} y={PT - 4} textAnchor="middle" fontSize={8} fill="#94a3b8">auj.</text>

          {/* Labels X */}
          {labelIdx.map(i => (
            <text key={i} x={sx(i)} y={H - 6} textAnchor="middle" fontSize={8} fill={i >= nVis ? '#b0bec5' : '#64748b'}>
              {allVis[i]?.day.slice(5)}
            </text>
          ))}

          {/* Crosshair */}
          {hovered !== null && hx !== null && hy !== null && (
            <>
              <line x1={hx} x2={hx} y1={PT} y2={PT + cH} stroke="#475569" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={hx} cy={hy} r={4.5} fill={isProj ? '#fff' : color} stroke={color} strokeWidth={2} />
            </>
          )}

          {/* Zone hover */}
          <rect x={PL} y={PT} width={cW} height={cH} fill="transparent" />
        </svg>

        {/* Tooltip */}
        {hp && hx !== null && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: `${tooltipPct}%`,
            transform: tooltipXform,
            background: '#0f172a',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          }}>
            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>
              {hp.day}{isProj ? ' · projection' : ''}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: isProj ? color + '88' : color }}>
              {fmt(hp.count)}
            </div>
          </div>
        )}
      </div>

      {/* Résumé */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        <span style={{ color: slope > 0.5 ? '#059669' : slope < -0.5 ? '#ef4444' : '#94a3b8' }}>
          {trendLabel}
        </span>
        <span>dans 1 an : ~{fmt(projEnd)}/jour</span>
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
    { period: "Aujourd'hui",       value: today },
    { period: '7 derniers jours',  value: week  },
    { period: '30 derniers jours', value: month },
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

  const userAvg = avg(stats.total_users, stats.oldest_user)
  const cardAvg = avg(stats.total_cards_manual, stats.oldest_card || stats.oldest_user)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Panel Admin</h1>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {updatedAt ? `Mis à jour ${updatedAt.toLocaleTimeString('fr-FR')}` : ''}
            </div>
          </div>
          <button
            onClick={load}
            style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Actualiser
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <KpiCard label="Inscrits total" value={stats.total_users} />
          <KpiCard label="Cartes total" value={stats.total_cards} sub={`dont ${fmt(stats.total_cards_manual)} manuelles`} />
          <KpiCard label="Nouveaux inscrits aujourd'hui" value={stats.today_users} />
          <KpiCard label="Cartes ajoutées aujourd'hui" value={stats.today_cards} />
        </div>

        {/* Tableaux stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <StatsTable
            label="👤 Inscriptions"
            today={stats.today_users} week={stats.week_users} month={stats.month_users}
            avgDay={userAvg.day} avgWeek={userAvg.week} avgMonth={userAvg.month}
          />
          <StatsTable
            label="🃏 Cartes ajoutées"
            note="scanner seulement"
            today={stats.today_cards} week={stats.week_cards} month={stats.month_cards}
            avgDay={cardAvg.day} avgWeek={cardAvg.week} avgMonth={cardAvg.month}
          />
        </div>

        {/* Graphiques */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Inscriptions', note: 'depuis le début · projection 1 an', data: stats.user_daily, color: ACCENT },
            { label: 'Cartes ajoutées', note: 'scanner · projection 1 an', data: stats.card_daily, color: '#059669' },
          ].map(({ label, note, data, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{note}</div>
              </div>
              <InteractiveChart data={data} color={color} />
            </div>
          ))}
        </div>

        {/* Utilisateurs actifs */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 14 }}>
            Utilisateurs actifs (ayant ajouté au moins 1 carte via scanner)
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
