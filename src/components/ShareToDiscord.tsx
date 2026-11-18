'use client'
// Bouton « Partager sur Discord » d'une belle carte tirée (épique ou légendaire).
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShareToDiscord({ entryId, className }: { entryId: number; className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  async function share() {
    if (state !== 'idle') return
    setState('busy'); setErr('')
    try {
      const { data } = await supabase.auth.getSession()
      const t = data.session?.access_token
      if (!t) { setErr('Connecte-toi.'); setState('idle'); return }
      const r = await fetch('/api/packs/share', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ entryId }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok || r.status === 409) { setState('done'); return }
      setErr(j.error || 'Partage impossible'); setState('idle')
    } catch { setErr('Connexion impossible'); setState('idle') }
  }
  return (
    <span className="pk-share">
      <button type="button" className={className} disabled={state !== 'idle'} onClick={() => void share()}>
        {state === 'done' ? '✓ Partagé sur Discord' : state === 'busy' ? 'Envoi…' : 'Partager sur Discord'}
      </button>
      {err && <small className="pk-share-err">{err}</small>}
    </span>
  )
}
