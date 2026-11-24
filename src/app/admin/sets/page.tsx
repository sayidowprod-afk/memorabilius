'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// 866 · Sets incomplets : ceux qui ont très peu de cartes (imports ratés), avec la commande de relance prête à copier.
// 867 · Sets en double : même sport, année et nom ; « Fusionner » reporte les cases cochées des membres sur le bon set (simulation d'abord), puis supprime l'autre.
interface SetItem { id: number; name: string; year: number | null; sport: string; total_cards: number | null; tcdb_id: number | null; lignes: number }
interface Audit { total: number; max: number; incomplete: SetItem[]; duplicates: SetItem[][] }
interface Hole { id: number; name: string; year: number | null; sport: string; tcdb_id: number | null; manque: number; max: number; exemples: string }
interface MergeSummary { from: string; to: string; casesReportees: number; casesDejaCochees: number; casesSansEquivalent: number; liensDeCartes: number }
const IGNORE_KEY = 'admin-sets-ignores'
const HOLES_KEY = 'admin-sets-trous'
const OK_TCDB = (x: number | null | undefined): x is number => !!x && x < 2_000_000   // au-delà : identifiants d'une autre source (Magic, Pokémon…), pas des sets TCDB
const CMD = (ids: number[]) => 'node scripts/relancer-sets.js ' + ids.join(' ')

export default function AdminSets() {
  const [max, setMax] = useState(5)
  const [data, setData] = useState<Audit | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [ignored, setIgnored] = useState<Set<number>>(new Set())
  const [plan, setPlan] = useState<{ fromId: number; toId: number; s: MergeSummary } | null>(null)
  const [busy, setBusy] = useState(false)
  const [holes, setHoles] = useState<Hole[] | null>(null)
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => { try { setIgnored(new Set(JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'))) } catch { /* liste illisible */ } }, [])
  useEffect(() => { try { const h = JSON.parse(localStorage.getItem(HOLES_KEY) || 'null'); if (Array.isArray(h)) setHoles(h) } catch { /* pas d'analyse gardée */ } }, [])
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

  // analyse des trous : le serveur lit les sets par tranches, la page enchaîne les appels (quelques minutes) ; le résultat est gardé dans le navigateur
  const scanHoles = async () => {
    setScan({ done: 0, total: data?.total || 0 }); const found: Hole[] = []
    try {
      let offset: number | null = 0
      while (offset !== null) {
        const r = await fetch('/api/admin/sets-audit?holes=1&offset=' + offset + '&limit=150', { headers: { Authorization: 'Bearer ' + await token() } })
        if (!r.ok) { toast.error('Analyse interrompue (réessaie : elle repart de zéro).'); break }
        const d: { total: number; next: number | null; holes: Hole[] } = await r.json()
        found.push(...d.holes); offset = d.next
        setScan({ done: offset === null ? d.total : offset, total: d.total }); setHoles([...found])
        if (offset === null) { try { localStorage.setItem(HOLES_KEY, JSON.stringify(found)) } catch { /* stockage indisponible */ } toast.success(found.length + ' set(s) avec un trou.') }
      }
    } finally { setScan(null) }
  }

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
  const shownHoles = (holes || []).filter(h => !ignored.has(h.id)).sort((a, b) => b.manque - a.manque)
  // tout relancer d'un coup : tous les sets listés (incomplets + trous) qui ont un lien TCDB, une seule commande (lots de 400 pour tenir dans une ligne)
  const relaunchIds = [...new Set([...shown.map(x => x.tcdb_id), ...shownHoles.map(x => x.tcdb_id)].filter(OK_TCDB))]
  const lots = Array.from({ length: Math.ceil(relaunchIds.length / 400) }, (_, i) => relaunchIds.slice(i * 400, i * 400 + 400))

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

          <div style={{ border: '2px solid rgba(128,128,128,.35)', padding: 12, margin: '22px 0 0' }}>
            <strong>Tout relancer d’un coup</strong>
            <div style={{ fontSize: 13, opacity: .85, margin: '4px 0 8px' }}>{relaunchIds.length} set(s) avec un lien TCDB (incomplets + trous ci-dessous). Colle la commande dans un terminal : elle les relance un par un, sans rien supprimer (seules les cartes qui manquent sont ajoutées). Si TCDB demande un captcha, résous-le dans la fenêtre Chrome.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lots.map((l, i) => <button key={i} type="button" style={btn} onClick={() => copy(CMD(l))}>Copier la commande{lots.length > 1 ? ' (lot ' + (i + 1) + '/' + lots.length + ' · ' + l.length + ' sets)' : ''}</button>)}
              {lots.length === 0 && <span style={{ fontSize: 12, opacity: .7 }}>Rien à relancer pour l’instant.</span>}
            </div>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '28px 0 6px' }}>Sets avec un trou ({shownHoles.length})</h2>
          <div style={{ fontSize: 13, opacity: .85, marginBottom: 8 }}>Un numéro absent dans la numérotation de la base (ex. 1…300 mais pas le 142). L’analyse lit tous les sets : compte quelques minutes.</div>
          <button type="button" style={btn} disabled={!!scan} onClick={scanHoles}>{scan ? 'Analyse… ' + Math.round(100 * scan.done / Math.max(1, scan.total)) + ' %' : holes ? 'Relancer l’analyse' : 'Analyser les trous'}</button>
          {shownHoles.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead><tr><th style={th}>Set</th><th style={th}>Sport</th><th style={th}>Numéros manquants</th><th style={th}>Actions</th></tr></thead>
                <tbody>
                  {shownHoles.map(h => (
                    <tr key={h.id}>
                      <td style={td}><Link href={'/setlist/' + h.id} target="_blank" style={{ fontWeight: 700 }}>{h.name}</Link><div style={{ fontSize: 11, opacity: .7 }}>{h.year} · n° {h.id}</div></td>
                      <td style={td}>{h.sport}</td>
                      <td style={td}><b>{h.manque}</b> sur {h.max}<div style={{ fontSize: 11, opacity: .7 }}>n° {h.exemples}</div></td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {OK_TCDB(h.tcdb_id)
                            ? <button type="button" style={btn} onClick={() => copy(CMD([h.tcdb_id as number]))}>Copier la commande de relance</button>
                            : <span style={{ fontSize: 11, opacity: .7 }}>sans lien TCDB (vient d’une autre source)</span>}
                          {OK_TCDB(h.tcdb_id) && <a href={'https://www.tcdb.com/ViewSet.cfm/sid/' + h.tcdb_id} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>TCDB ↗</a>}
                          <button type="button" style={btn} onClick={() => ignore(h.id)} title="Ces numéros n’existent pas vraiment : ne plus montrer ce set">C’est normal</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {holes && holes.length === 0 && !scan && <p style={{ fontSize: 13 }}>Aucun trou trouvé. ✓</p>}

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
                        {OK_TCDB(s.tcdb_id)
                          ? <button type="button" style={btn} onClick={() => copy('node scripts/ajouter-set-tcdb.js https://www.tcdb.com/ViewSet.cfm/sid/' + s.tcdb_id)}>Copier la commande de relance</button>
                          : <span style={{ fontSize: 11, opacity: .7 }}>sans lien TCDB (vient d’une autre source)</span>}
                        {OK_TCDB(s.tcdb_id) && <a href={'https://www.tcdb.com/ViewSet.cfm/sid/' + s.tcdb_id} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none' }}>TCDB ↗</a>}
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
