'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// Demandes de setlist des membres, classées par nombre de « Moi aussi » : on ajoute d'abord les plus attendues.
// Passer une demande à « Ajoutée » (avec l'identifiant de la setlist) prévient automatiquement tous ceux qui l'attendaient, une seule fois.
interface Row { id: string; sport: string; name: string; link: string | null; status: string; set_id: string | null; votes: number; created_at: string }
const STATUTS: [string, string][] = [['demandee', 'Demandée'], ['en_cours', 'En cours'], ['ajoutee', 'Ajoutée'], ['refusee', 'Refusée']]

export default function AdminSetlistDemandes() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [setIds, setSetIds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Connecte-toi.'); return }
    const r = await fetch('/api/admin/setlist-requests', { headers: { Authorization: 'Bearer ' + session.access_token } })
    if (r.status === 403) { setError('Accès réservé aux admins.'); return }
    if (!r.ok) { setError('Impossible de charger les demandes (la migration 20261122 est-elle appliquée ?).'); return }
    const d = await r.json()
    setRows(d.requests || [])
  }, [])
  useEffect(() => { load() }, [load])

  const update = async (row: Row, status: string) => {
    setBusy(row.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/setlist-requests/' + row.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }, body: JSON.stringify({ status, set_id: setIds[row.id] || row.set_id || null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || 'Échec'); return }
      toast.success(status === 'ajoutee' ? 'Ajoutée : ' + (d.notified || 0) + ' membre(s) prévenu(s).' : 'État mis à jour.')
      load()
    } finally { setBusy(null) }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid rgba(128,128,128,.35)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px', fontSize: 13, borderBottom: '1px solid rgba(128,128,128,.2)', verticalAlign: 'top' }

  return (
    <div style={{ maxWidth: 1000, margin: '30px auto', padding: '0 16px' }}>
      <Link href="/admin" style={{ fontSize: 13 }}>← Admin</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: '10px 0 6px' }}>📚 Demandes de setlist</h1>
      <p style={{ fontSize: 13, opacity: .8, margin: '0 0 16px' }}>Classées par nombre de membres qui la veulent. Quand tu passes une demande à « Ajoutée », colle l’adresse de la page de la setlist sur le site (ou juste son numéro, celui de /setlist/8947) : chaque membre qui l’attendait reçoit une notification avec le lien.</p>
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      {rows === null && !error && <p>Chargement…</p>}
      {rows && rows.length === 0 && <p>Aucune demande pour le moment.</p>}
      {rows && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr><th style={th}>Demande</th><th style={th}>Sport</th><th style={th}>Membres</th><th style={th}>État</th><th style={th}>ID de la setlist</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}><strong>{r.name}</strong>{r.link && <div style={{ fontSize: 11, overflowWrap: 'anywhere' }}><a href={r.link} target="_blank" rel="noopener noreferrer">{r.link}</a></div>}</td>
                  <td style={td}>{r.sport}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{r.votes}</td>
                  <td style={td}>
                    <select value={r.status} disabled={busy === r.id} onChange={e => update(r, e.target.value)}>
                      {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td style={td}><input value={setIds[r.id] ?? r.set_id ?? ''} onChange={e => setSetIds(m => ({ ...m, [r.id]: e.target.value }))} placeholder="adresse ou n° (8947)" style={{ width: 170 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
