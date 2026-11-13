'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Audience réelle du site : (910) pages les plus vues, (907) heures d'affluence par pays pour savoir quand publier, (906) d'où viennent les visites et les inscrits.
interface Data {
  sampled: number; since: string; sourcesReady: boolean
  pages: { path: string; n: number; prev: number }[]
  hours: { country: string; total: number; local: number[]; fr: number[]; peakLocal: number; peakFr: number }[]
  sources: { src: string; visits: number; signups: number }[]
}
const NAMES: Record<string, string> = { US: 'États-Unis', CA: 'Canada', GB: 'Royaume-Uni', DE: 'Allemagne', FR: 'France', ES: 'Espagne', IT: 'Italie', BE: 'Belgique', CH: 'Suisse' }
const h2 = (h: number) => String(h).padStart(2, '0') + ' h'

export default function AdminAudience() {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [mode, setMode] = useState<'local' | 'fr'>('local')
  const load = async (fresh = false) => {
    setErr('')
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/audience' + (fresh ? '?fresh=1' : ''), { headers: { Authorization: 'Bearer ' + (session?.access_token || '') } })
    if (r.status === 403) { setErr('Accès réservé aux admins.'); return }
    if (!r.ok) { setErr('Impossible de charger l’audience.'); return }
    setD(await r.json())
  }
  useEffect(() => { load() }, [])

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid rgba(128,128,128,.35)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid rgba(128,128,128,.2)' }
  const h3: React.CSSProperties = { fontSize: 18, fontWeight: 900, margin: '28px 0 6px' }

  return (
    <div style={{ maxWidth: 1000, margin: '30px auto', padding: '0 16px' }}>
      <Link href="/admin" style={{ fontSize: 13 }}>← Admin</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: '10px 0 6px' }}>📈 Audience</h1>
      {err && <p style={{ color: '#c0392b' }}>{err}</p>}
      {!d && !err && <p>Analyse des visites (quelques secondes)…</p>}
      {d && (
        <>
          <p style={{ fontSize: 13, opacity: .8 }}>{d.sampled.toLocaleString('fr-FR')} pages vues sur 30 jours. <button type="button" onClick={() => load(true)} style={{ border: '1px solid rgba(128,128,128,.5)', background: 'transparent', color: 'inherit', fontSize: 12, cursor: 'pointer' }}>Actualiser</button></p>

          <h2 style={h3}>Quand publier : les heures d’affluence réelles</h2>
          <p style={{ fontSize: 13, opacity: .8, margin: '0 0 8px' }}>Chaque barre est une heure ; la plus haute est le moment où le plus de visiteurs de ce pays sont sur le site. Le pic indiqué est la meilleure plage de 3 heures.</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['local', 'fr'] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} style={{ padding: '4px 10px', border: '1px solid rgba(128,128,128,.5)', background: mode === m ? '#003DA6' : 'transparent', color: mode === m ? '#fff' : 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{m === 'local' ? 'Heure du pays' : 'Heure de France (pour programmer)'}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {d.hours.map(c => {
              const arr = mode === 'local' ? c.local : c.fr, max = Math.max(1, ...arr), pk = mode === 'local' ? c.peakLocal : c.peakFr
              return (
                <div key={c.country} style={{ border: '1px solid rgba(128,128,128,.35)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{NAMES[c.country] || c.country}</b><span style={{ fontSize: 12, opacity: .7 }}>{c.total.toLocaleString('fr-FR')} vues</span></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70, margin: '8px 0 4px' }}>
                    {arr.map((n, h) => { const inPeak = (h - pk + 24) % 24 < 3; return <i key={h} title={h2(h) + ' : ' + n + ' vues'} style={{ flex: 1, height: Math.max(2, n / max * 70), background: inPeak ? '#2f6bff' : 'rgba(128,128,128,.5)' }} /> })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: .6 }}><span>0 h</span><span>12 h</span><span>23 h</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>Pic : {h2(pk)} – {h2((pk + 3) % 24)}</div>
                </div>
              )
            })}
          </div>

          <h2 style={h3}>Pages les plus vues (7 jours)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Page</th><th style={th}>7 jours</th><th style={th}>7 jours avant</th><th style={th}>Évolution</th></tr></thead>
            <tbody>{d.pages.map(p => {
              const evo = p.prev ? Math.round((p.n - p.prev) / p.prev * 100) : null
              return <tr key={p.path}><td style={td}><b>{p.path}</b></td><td style={td}>{p.n.toLocaleString('fr-FR')}</td><td style={td}>{p.prev.toLocaleString('fr-FR')}</td><td style={{ ...td, color: evo == null ? undefined : evo >= 0 ? '#1e9e57' : '#c0392b', fontWeight: 700 }}>{evo == null ? 'nouveau' : (evo >= 0 ? '+' : '') + evo + ' %'}</td></tr>
            })}</tbody>
          </table>

          <h2 style={h3}>D’où viennent les visites et les inscrits (30 jours)</h2>
          {!d.sourcesReady && <p style={{ fontSize: 13, color: '#c98a12' }}>Les sources ne sont pas encore enregistrées : applique la migration <code>20261123_sources.sql</code> dans Supabase. Les visites commencent à être étiquetées dès ce moment.</p>}
          <p style={{ fontSize: 13, opacity: .8, margin: '0 0 8px' }}>Donne à chaque publication son lien : <code>memorabilius.fr/?src=tiktok-us</code>, <code>?src=reels-fr</code>, <code>?src=reddit-nba</code>… La source de la première visite est retenue, puis rattachée au membre à son inscription.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Source</th><th style={th}>Visites</th><th style={th}>Inscrits</th><th style={th}>Taux</th></tr></thead>
            <tbody>{d.sources.map(s => <tr key={s.src}><td style={td}><b>{s.src}</b></td><td style={td}>{s.visits.toLocaleString('fr-FR')}</td><td style={td}>{s.signups}</td><td style={td}>{s.visits ? (s.signups / s.visits * 100).toFixed(1) + ' %' : '—'}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  )
}
