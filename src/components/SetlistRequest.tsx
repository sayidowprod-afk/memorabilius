'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

const SPORTS: [string, string][] = [
  ['nba', 'NBA'], ['euro-basketball', 'Basketball Europe'], ['wnba', 'WNBA'], ['nfl', 'NFL'], ['baseball', 'Baseball'], ['hockey', 'Hockey'],
  ['soccer-international', 'Football'], ['racing', 'Racing'], ['tennis', 'Tennis'], ['wrestling', 'Wrestling'], ['mma', 'MMA'], ['pokemon', 'Pokémon'], ['mtg', 'MTG'], ['non-sport', 'Non-Sport'], ['autre', 'Autre'],
]

// Demande d'ajout d'une setlist manquante : part dans le meme circuit que les retours utilisateurs (admin > signalements + e-mail),
// et (828) apparait dans « Demandes de setlists » : etat, « Moi aussi », notification quand la setlist est ajoutee.
type Req = { id: string; sport: string; name: string; status: 'demandee' | 'en_cours' | 'ajoutee' | 'refusee'; set_id: string | null; votes: number; voted: boolean; mine: boolean }
const STATUS: Record<string, [string, string]> = { demandee: ['Demandée', '#5b6b8c'], en_cours: ['En cours', '#c98a12'], ajoutee: ['Ajoutée ✓', '#1e9e57'] }
export default function SetlistRequest({ defaultSport }: { defaultSport: string }) {
  const [open, setOpen] = useState(false)
  const [sport, setSport] = useState(defaultSport)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [reqs, setReqs] = useState<Req[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const r = await fetch('/api/setlist-requests', { headers: { Authorization: 'Bearer ' + session.access_token } })
      if (r.ok) { const d = await r.json(); setReqs(Array.isArray(d.requests) ? d.requests : []) }
    } catch { /* la liste est un plus : le formulaire marche sans */ }
  }, [])
  useEffect(() => { load() }, [load])

  const vote = async (q: Req) => {
    setBusyId(q.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Connecte-toi pour dire « moi aussi ».'); return }
      const r = await fetch('/api/setlist-requests/' + q.id, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ on: !q.voted }) })
      if (r.ok) { const d = await r.json(); setReqs(list => list.map(x => (x.id === q.id ? { ...x, votes: d.votes, voted: d.voted } : x))) }
    } catch { toast.error('Impossible pour le moment.') }
    setBusyId(null)
  }

  const submit = async () => {
    if (name.trim().length < 3) return
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const label = SPORTS.find(s => s[0] === sport)?.[1] || sport
      const message = `[Demande de setlist] ${label} : ${name.trim()}${link.trim() ? `\nLien TCDB / source : ${link.trim()}` : ''}`
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ type: 'suggestion', message, pageUrl: '/setlist' }),
      })
      if (!r.ok) throw new Error()
      // suivi de la demande (828) : en plus du retour envoyé à l'équipe ; sans effet si la fonction n'est pas encore installée
      if (session?.access_token) {
        await fetch('/api/setlist-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ sport, name: name.trim(), link: link.trim() }) }).catch(() => {})
        load()
      }
      setSent(true); setName(''); setLink('')
    } catch { toast.error('Envoi impossible, réessaie dans un instant.') }
    setSending(false)
  }

  return (
    <div className="sl-req">
      <div className="sl-req-t">Il manque une setlist ?</div>
      <p className="sl-req-p">Dis-nous laquelle (set, année, marque) et on l&apos;ajoute dès que possible.</p>
      {sent ? (
        <div className="sl-req-ok">✓ Demande envoyée, merci ! <button type="button" onClick={() => { setSent(false); setOpen(true) }}>Une autre</button></div>
      ) : !open ? (
        <button type="button" className="sl-req-btn" onClick={() => setOpen(true)}>Demander une setlist</button>
      ) : (
        <div className="sl-req-form">
          <select value={sport} onChange={e => setSport(e.target.value)}>{SPORTS.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : 2023-24 Panini Prizm Euroleague" maxLength={200} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Lien TCDB (facultatif)" maxLength={300} />
          <div className="sl-req-act">
            <button type="button" className="sl-req-btn" disabled={sending || name.trim().length < 3} onClick={submit}>{sending ? 'Envoi…' : 'Envoyer la demande'}</button>
            <button type="button" className="sl-req-cancel" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </div>
      )}
      {reqs.length > 0 && (
        <div style={{ width: '100%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="sl-req-t" style={{ fontSize: 15 }}>Demandes de setlists</div>
          {reqs.map(q => {
            const [label, color] = STATUS[q.status] || STATUS.demandee
            const sportLabel = SPORTS.find(x => x[0] === q.sport)?.[1] || q.sport
            return (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(128,128,128,.35)', padding: '8px 10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #111)', overflowWrap: 'anywhere' }}>{q.name}{q.mine ? ' · ta demande' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2, #666)' }}>{sportLabel} · {q.votes} membre{q.votes > 1 ? 's' : ''} {q.votes > 1 ? 'la veulent' : 'la veut'}</div>
                </div>
                <span style={{ background: color, color: '#fff', font: '800 10px system-ui', letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px' }}>{label}</span>
                {q.status === 'ajoutee'
                  ? (q.set_id ? <Link href={'/setlist/' + q.set_id} style={{ fontSize: 12, fontWeight: 800 }}>Voir →</Link> : null)
                  : <button type="button" className="sl-req-cancel" disabled={busyId === q.id} onClick={() => vote(q)} aria-pressed={q.voted}
                      style={q.voted ? { fontWeight: 800 } : undefined}>{q.voted ? '✓ Moi aussi' : '＋ Moi aussi'}</button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
