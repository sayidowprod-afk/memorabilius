'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

const SPORTS: [string, string][] = [
  ['nba', 'NBA'], ['euro-basketball', 'Basketball Europe'], ['wnba', 'WNBA'], ['nfl', 'NFL'], ['baseball', 'Baseball'], ['hockey', 'Hockey'],
  ['soccer-international', 'Football'], ['racing', 'Racing'], ['tennis', 'Tennis'], ['wrestling', 'Wrestling'], ['mma', 'MMA'], ['pokemon', 'Pokémon'], ['mtg', 'MTG'], ['autre', 'Autre'],
]

// Demande d'ajout d'une setlist manquante : part dans le meme circuit que les retours utilisateurs (admin > signalements + e-mail).
export default function SetlistRequest({ defaultSport }: { defaultSport: string }) {
  const [open, setOpen] = useState(false)
  const [sport, setSport] = useState(defaultSport)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

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
    </div>
  )
}
