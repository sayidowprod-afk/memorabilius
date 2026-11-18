'use client'
// Bouton « Partager » d'une belle carte tirée (épique ou légendaire) : crée un lien court, à coller n'importe où (Discord affiche la carte en aperçu).
// Sur téléphone, ouvre directement le partage du système (Discord, Messages, etc.).
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShareToDiscord({ entryId, className }: { entryId: number; className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [url, setUrl] = useState('')
  async function share() {
    if (state === 'busy') return
    setState('busy'); setErr('')
    try {
      let link = url
      if (!link) {
        const { data } = await supabase.auth.getSession()
        const t = data.session?.access_token
        if (!t) { setErr('Connecte-toi.'); setState('idle'); return }
        const r = await fetch('/api/packs/share', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ entryId }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.url) { setErr(j.error || 'Partage impossible'); setState('idle'); return }
        link = j.url as string; setUrl(link)
      }
      const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
      if (coarse && typeof navigator.share === 'function') {
        try { await navigator.share({ url: link, title: 'Mon tirage sur Memorabilius' }); setState('done'); return } catch { /* annulé : on copie le lien à la place */ }
      }
      try { await navigator.clipboard.writeText(link); setState('done') }
      catch { setErr('Copie le lien : ' + link); setState('idle') }
    } catch { setErr('Connexion impossible'); setState('idle') }
  }
  return (
    <span className="pk-share">
      <button type="button" className={className} disabled={state === 'busy'} onClick={() => void share()}>
        {state === 'done' ? '✓ Lien copié : colle-le sur Discord' : state === 'busy' ? 'Un instant…' : 'Partager le lien'}
      </button>
      {err && <small className="pk-share-err">{err}</small>}
    </span>
  )
}
