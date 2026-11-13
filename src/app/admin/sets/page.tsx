'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// 866 · Sets incomplets : ceux qui ont très peu de cartes (imports ratés), avec la commande de relance prête à copier.
// 867 · Sets en double : même sport, année et nom ; « Fusionner » reporte les cases cochées des membres sur le bon set (simulation d'abord), puis supprime l'autre.
interface SetItem { id: number; name: string; year: number | null; sport: string; total_cards: number | null; tcdb_id: number | null; lignes: number }
interface Audit { total: number; max: number; incomplete: SetItem[]; duplicates: SetItem[][] }
interface MergeSummary { from: string; to: string; casesReportees: number; casesDejaCochees: number; casesSansEquivalent: number; liensDeCartes: number }
const IGNORE_KEY = 'admin-sets-ignores'

export default function AdminSets() {
  const [max, setMax] = useState(5)
  const [data, setData] = useState<Audit | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [ignored, setIgnored] = useState<Set<number>>(new Set())
  const [plan, setPlan] = useState<{ fromId: number; toId: number; s: MergeSummary } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { try { setIgnored(new Set(JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'))) } catch { /* liste illisible */ } }, [])
  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const r = await fetch('/api/admin/sets-audit?max=' + max, { headers: { Authorization: 'Bearer ' + await token() } })
    if (r.status === 403) { setError('Accès réservé aux admins.'); setLoading(false); return }
    if (!r.ok) { setError('Impossible de charger l’audit.'); setLoading(false); return }
    setData(await r.json()); setLoading(false)
  }, [max])
  useEffect(() => { load() }, [load])

  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success('Commande copiée.') } catch { toast.error('Copie impossible.') } }
  const ignore = (id: number) => { const n = new Set(ignored); n.add(id); setIgnored(n); try { localStorage.setItem(IGNORE_KEY, JSON.stringify([...n])) } catch { /* stockage indisponible */ } }

  const merge = async (fromId: number, toId: number, dryRun: boolean) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/sets-audit', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() }, body: JSON.stringify({ fromId, toId, dryRun }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || 'Échec'); return }
      if (dryRun) setPlan({ fromId, toId, s: d })
      else { toast.success('Fusion terminée.'); setPlan(null); load() }
    } finally { setBusy(false) }
  }

  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid rgba(128,128,128,.2)', verticalAlign: 'top' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid rgba(128,128,128,.35)', whiteSpace: 'nowrap' }
  const btn: React.CSSProperties = { padding: '4px 9px', border: '1px solid rgba(128,128,128,.55)', background: 'transparent', color: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer' }
  const shown = (data?.incomplete || []).filter(s => !ignored.has(s.id))

  return (
    <div style={{ maxWidth: 1000, margin: '30px auto', padding: '0 16px' }}>
      <Link href="/admin" style={{ fontSize: 13 }}>← Admin</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: '10px 0 6px' }}>🧹 Santé des sets</h1>
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      {loading && !error && <p>Analyse en cours (quelques secondes)…</p>}

      {data && (
        <>
          <p style={{ fontSize: 13, opacity: .8 }}>{data.total.toLocaleString('fr-FR')} sets au total.</p>

          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '22px 0 6px' }}>Sets en double ({data.duplicates.length})</h2>
          {data.duplicates.length === 0 && <p style={{ fontSize: 13 }}>Aucun doublon : tout est propre. ✓</p>}
          {data.duplicates.map(g => (
            <div key={g[0].id} style={{ border: '2px solid rgba(128,128,128,.35)', padding: 12, marginBottom: 10 }}>
              <strong>{g[0].name}</strong> <span style={{ opacity: .7 }}>({g[0].year}, {g[0].sport})</span>
              {g.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid rgba(128,128,128,.2)', marginTop: 6 }}>
                  <Link href={'/setlist/' + s.id} target="_blank" style={{ fontWeight: 700 }}>n° {s.id}</Link>
                  <span style={{ fontSize: 13 }}>{s.lignes} lignes{s.tcdb_id ? ' · TCDB ' + s.tcdb_id : ' · sans lien TCDB'}</span>
                  {i === 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: '#1e9e57' }}>À GARDER (le plus complet)</span>
                    : <button type="button" style={btn} disabled={busy} onClick={() => merge(s.id, g[0].id, true)}>Fusionner dans le n° {g[0].id}…</button>}
                </div>
              ))}
            </div>
          ))}
          {plan && (
            <div style={{ border: '2px solid #e0a526', padding: 14, margin: '10px 0', background: 'rgba(224,165,38,.08)' }}>
              <strong>Simulation de la fusion (rien n’est encore modifié)</strong>
              <div style={{ fontSize: 13, margin: '6px 0' }}>{plan.s.from} <b>→</b> {plan.s.to}</div>
              <ul style={{ fontSize: 13, margin: '0 0 10px', paddingLeft: 18 }}>
                <li>{plan.s.casesReportees} case(s) cochée(s) reportée(s) sur le bon set</li>
                <li>{plan.s.casesDejaCochees} déjà cochée(s) là-bas (rien à faire)</li>
                <li>{plan.s.casesSansEquivalent} sans équivalent dans le bon set (perdues)</li>
                <li>{plan.s.liensDeCartes} lien(s) carte ↔ ligne reporté(s)</li>
              </ul>
              <button type="button" style={{ ...btn, background: '#d6293e', borderColor: '#d6293e', color: '#fff' }} disabled={busy} onClick={() => merge(plan.fromId, plan.toId, false)}>Confirmer la fusion et supprimer le set en trop</button>
              <button type="button" style={{ ...btn, marginLeft: 8 }} onClick={() => setPlan(null)}>Annuler</button>
            </div>
          )}

          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '28px 0 6px' }}>Sets incomplets ({shown.length})</h2>
          <label style={{ fontSize: 13 }}>Afficher les sets de moins de{' '}
            <select value={max} onChange={e => setMax(parseInt(e.target.value))}>{[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} cartes</option>)}</select>
          </label>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr><th style={th}>Set</th><th style={th}>Sport</th><th style={th}>Cartes</th><th style={th}>Actions</th></tr></thead>
              <tbody>
                {shown.map(s => (
                  <tr key={s.id}>
                    <td style={td}><Link href={'/setlist/' + s.id} target="_blank" style={{ fontWeight: 700 }}>{s.name}</Link><div style={{ fontSize: 11, opacity: .7 }}>{s.year} · n° {s.id}</div></td>
                    <td style={td}>{s.sport}</td>
                    <td style={td}><b>{s.lignes}</b>{s.total_cards !== s.lignes && <div style={{ fontSize: 11, opacity: .7 }}>(total noté : {s.total_cards ?? '—'})</div>}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.tcdb_id
                          ? <button type="button" style={btn} onClick={() => copy('node scripts/ajouter-set-tcdb.js https://www.tcdb.com/ViewSet.cfm/sid/' + s.tcdb_id)}>Copier la commande de relance</button>
                          : <span style={{ fontSize: 11, opacity: .7 }}>sans lien TCDB (vient d’une autre source)</span>}
                        {s.tcdb_id && <a href={'https://www.tcdb.com/ViewSet.cfm/sid/' + s.tcdb_id} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>TCDB ↗</a>}
                        <button type="button" style={btn} onClick={() => ignore(s.id)} title="Ce set est volontairement petit : ne plus le montrer">C’est normal</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td style={td} colSpan={4}>Aucun set à vérifier à ce seuil. ✓</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
