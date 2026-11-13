'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// 858 · Signaler une erreur sur une ligne de setlist : le signalement arrive dans l'admin (« Signalements ») avec le set, la variation et la ligne déjà indiqués.
const REASONS = ['Il manque une carte', 'Mauvais numéro ou nom', 'Image incorrecte', 'Doublon', 'Autre']

export default function SetlistReportDialog({ setId, setName, variation, entry, onClose }: {
  setId: string; setName: string; variation: string
  entry: { id: number; card_number: string | null; player_name: string }
  onClose: () => void
}) {
  const [reason, setReason] = useState(REASONS[0])
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const message = '[Erreur de setlist] ' + setName + ' (set ' + setId + ') · ' + (variation || 'Base') + ' · n° ' + (entry.card_number || '—') + ' ' + entry.player_name + ' (ligne ' + entry.id + ') : ' + reason + (note.trim() ? '\n' + note.trim().slice(0, 500) : '')
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}) },
        body: JSON.stringify({ type: 'bug', message, pageUrl: '/setlist/' + setId }),
      })
      if (!r.ok) throw new Error()
      toast.success('Merci, le problème est signalé.')
      onClose()
    } catch { toast.error('Envoi impossible, réessaie dans un instant.') }
    setSending(false)
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Signaler un problème" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 20000000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg2, #0e1530)', color: 'var(--text, #f0f0f0)', border: '2px solid var(--border, #243063)', width: 'min(420px, 100%)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <b style={{ flex: 1, fontSize: 16 }}>Signaler un problème</b>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 0, color: 'inherit', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2, #aab3d1)', overflowWrap: 'anywhere' }}>{setName} · {variation || 'Base'}<br />n° {entry.card_number || '—'} · {entry.player_name}</div>
        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {REASONS.map(r => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px solid ' + (reason === r ? '#2f6bff' : 'var(--border, #243063)'), padding: '8px 10px', cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />{r}
            </label>
          ))}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Précision (facultatif)" maxLength={500} rows={2}
          style={{ background: 'var(--bg3, #17214a)', border: '2px solid var(--border, #243063)', color: 'inherit', padding: '8px 10px', fontSize: 14, resize: 'vertical' }} />
        <button type="button" disabled={sending} onClick={send} style={{ padding: '12px', background: '#2f6bff', border: 0, color: '#fff', font: '800 13px system-ui', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>{sending ? 'Envoi…' : 'Envoyer'}</button>
      </div>
    </div>,
    document.body,
  )
}
