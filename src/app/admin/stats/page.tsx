'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT = '#003DA6'

type DailyPoint = { day: string; count: number }

type Stats = {
  total_users: number
  today_users: number
  week_users: number
  month_users: number
  oldest_user: string
  total_cards: number
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

// ── Graphique barres SVG ───────────────────────────────────────────────────

function BarChart({ data, color = ACCENT }: { data: DailyPoint[]; color?: string }) {
  if (!data?.length) return null
  // Remplir les 30 derniers jours (jours manquants = 0)
  const filled: DailyPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
    const day = d.toISOString().slice(0, 10)
    const found = data.find(p => p.day?.slice(0, 10) === day)
    filled.push({ day, count: found?.count ?? 0 })
  }
  const max = Math.max(1, ...filled.map(p => p.count))
  const W = 600; const H = 80; const BAR_W = W / 30 - 2

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {filled.map((p, i) => {
        const bh = Math.max(2, (p.count / max) * H)
        const x = i * (W / 30) + 1
        const y = H - bh
        const isWeekend = [0, 6].includes(new Date(p.day + 'T12:00:00Z').getUTCDay())
        return (
          <g key={p.day}>
            <rect
              x={x} y={y} width={BAR_W} height={bh}
              fill={isWeekend ? color + 'aa' : color}
              rx={2}
            >
              <title>{p.day} : {p.count}</title>
            </rect>
            {(i === 0 || i === 14 || i === 29) && (
              <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="#64748b">
                {p.day.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Carte KPI ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{typeof value === 'number' ? fmt(value) : value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Tableau stats ──────────────────────────────────────────────────────────

function StatsTable({ label, today, week, month, avgDay, avgWeek, avgMonth }: {
  label: string; today: number; week: number; month: number
  avgDay: string; avgWeek: string; avgMonth: string
}) {
  const rows = [
    { period: "Aujourd'hui", value: today },
    { period: '7 derniers jours', value: week },
    { period: '30 derniers jours', value: month },
    { period: 'Moyenne / jour', value: avgDay, isAvg: true },
    { period: 'Moyenne / semaine', value: avgWeek, isAvg: true },
    { period: 'Moyenne / mois', value: avgMonth, isAvg: true },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 14 }}>
        {label}
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
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
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
  const cardAvg = avg(stats.total_cards, stats.oldest_card || stats.oldest_user)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

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
          <KpiCard label="Cartes total" value={stats.total_cards} />
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
            today={stats.today_cards} week={stats.week_cards} month={stats.month_cards}
            avgDay={cardAvg.day} avgWeek={cardAvg.week} avgMonth={cardAvg.month}
          />
        </div>

        {/* Graphiques */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Inscriptions — 30 derniers jours', data: stats.user_daily, color: ACCENT },
            { label: 'Cartes ajoutées — 30 derniers jours', data: stats.card_daily, color: '#059669' },
          ].map(({ label, data, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 16 }}>{label}</div>
              <BarChart data={data} color={color} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'right' }}>
                max : {Math.max(0, ...data.map(p => p.count))} · total : {data.reduce((s, p) => s + p.count, 0)}
              </div>
            </div>
          ))}
        </div>

        {/* Utilisateurs actifs */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 14 }}>
            Utilisateurs actifs (ayant ajouté au moins 1 carte)
          </div>
          <div style={{ display: 'flex', gap: 48 }}>
            {[
              { label: 'Cette semaine', value: stats.active_users_week },
              { label: 'Ce mois', value: stats.active_users_month },
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
