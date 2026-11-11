'use client'
// Vitesse réelle du site chez les membres (mesures échantillonnées, voir WebVitalsReporter.tsx). Réservé aux admins.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

type Row = { page: string; device: string; metric: string; n: number; p50: number; p75: number }
// seuils de référence (Google) : bon / à améliorer
const LIM: Record<string, [number, number]> = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], TTFB: [800, 1800], FCP: [1800, 3000] }
const METRICS = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const
const fmt = (m: string, v: number) => m === 'CLS' ? v.toFixed(3) : v >= 1000 ? (v / 1000).toFixed(1) + ' s' : Math.round(v) + ' ms'
const color = (m: string, v: number) => { const [g, o] = LIM[m]; return v <= g ? '#1e9e57' : v <= o ? '#c98a12' : '#d6293e' }

export default function AdminPerformancePage() {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [days, setDays] = useState(7)
  const [device, setDevice] = useState<'tous' | 'mobile' | 'desktop' | 'app'>('tous')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single().then(({ data: p }) => setIsAdmin(p?.is_admin ?? false))
  }, [user, loading])

  useEffect(() => {
    if (!isAdmin) return
    let dead = false
    supabase.rpc('web_vitals_summary', { p_days: days }).then(({ data, error }) => {
      if (dead) return
      if (error) { setErr(error.message); setRows([]); return }
      setErr(null); setRows((data || []) as Row[])
    })
    return () => { dead = true }
  }, [isAdmin, days])

  // une ligne par page : mesure → p75 (et nombre de mesures), tous appareils ou celui choisi
  const table = useMemo(() => {
    const by = new Map<string, Map<string, { n: number; p75: number; p50: number }>>()
    for (const r of rows || []) {
      if (device !== 'tous' && r.device !== device) continue
      const m = by.get(r.page) ?? new Map(); by.set(r.page, m)
      const cur = m.get(r.metric)
      // plusieurs appareils fusionnés : p75 pondéré par le nombre de mesures (approximation suffisante pour repérer ce qui est lent)
      if (!cur) m.set(r.metric, { n: Number(r.n), p75: r.p75, p50: r.p50 })
      else { const n = cur.n + Number(r.n); m.set(r.metric, { n, p75: (cur.p75 * cur.n + r.p75 * Number(r.n)) / n, p50: (cur.p50 * cur.n + r.p50 * Number(r.n)) / n }) }
    }
    return [...by.entries()].map(([page, m]) => ({ page, m, n: Math.max(...[...m.values()].map(x => x.n)) })).sort((a, b) => b.n - a.n)
  }, [rows, device])

  if (isAdmin === null) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!isAdmin) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Accès réservé aux admins.</div>

  const sel: React.CSSProperties = { padding: '6px 10px', border: '2px solid #ccc', fontWeight: 700 }
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Link href="/admin" style={{ fontSize: 14, fontWeight: 700, textDecoration: 'none', color: 'inherit' }}>← Administration</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: '12px 0 4px' }}>⚡ Vitesse réelle du site</h1>
      <p style={{ color: '#888', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
        Mesures prises chez les membres (1 visite sur 5, aucune donnée personnelle). Chaque case montre le 75e centile : 3 visites sur 4 sont plus rapides que cette valeur.
        Vert = bon, orange = à améliorer, rouge = lent (seuils de référence de Google).
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={sel}><option value={1}>Dernières 24 h</option><option value={7}>7 jours</option><option value={30}>30 jours</option></select>
        <select value={device} onChange={e => setDevice(e.target.value as typeof device)} style={sel}><option value="tous">Tous les appareils</option><option value="mobile">Téléphone (navigateur)</option><option value="desktop">Ordinateur</option><option value="app">Appli Android</option></select>
      </div>
      {err && <div style={{ border: '2px solid #d6293e', padding: 14, marginBottom: 16, fontSize: 14 }}>La fonction de mesure n’est pas encore installée dans Supabase (ou elle est refusée) : <code>{err}</code><br />Applique la migration <code>supabase/migrations/20261118_web_vitals.sql</code> dans le SQL editor.</div>}
      {rows && !err && table.length === 0 && <p style={{ color: '#888' }}>Aucune mesure pour l’instant : elles arrivent au fil des visites (1 sur 5), quelques minutes après l’installation.</p>}
      {table.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '3px solid #333' }}>
              <th style={{ padding: '8px 6px' }}>Page</th>{METRICS.map(m => <th key={m} style={{ padding: '8px 6px' }} title={m === 'LCP' ? 'Temps avant que le contenu principal soit affiché' : m === 'INP' ? 'Délai de réaction aux clics et aux touchers' : m === 'CLS' ? 'Stabilité de la mise en page (sauts)' : m === 'TTFB' ? 'Temps de réponse du serveur' : 'Premier affichage'}>{m}</th>)}<th style={{ padding: '8px 6px' }}>Mesures</th>
            </tr></thead>
            <tbody>
              {table.map(r => (
                <tr key={r.page} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 800 }}>{r.page}</td>
                  {METRICS.map(m => { const c = r.m.get(m); return <td key={m} style={{ padding: '8px 6px', color: c ? color(m, c.p75) : '#aaa', fontWeight: 800 }}>{c ? fmt(m, c.p75) : '—'}</td> })}
                  <td style={{ padding: '8px 6px', color: '#888' }}>{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
