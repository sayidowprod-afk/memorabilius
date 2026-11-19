'use client'
// Échange de doublons contre un pack bonus (par thème) : fenêtre utilisée dans la fenêtre du pack ET dans « Mes cartes tirées ».
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SPORT_LABEL, MIN_SPORT_POOL } from '@/lib/packs'
import '@/app/packs/packs.css'

type S = { dupes: number; dupesPerPack: number; sports: [string, number][]; bonus: Record<string, number> }

export default function PackTrade({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [st, setSt] = useState<S | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const load = useCallback(async (t: string) => {
    const r = await fetch('/api/packs', { headers: { Authorization: 'Bearer ' + t } })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(j.error || 'Chargement impossible'); return }
    setSt({ dupes: j.dupes || 0, dupesPerPack: j.dupesPerPack || 15, sports: (j.sports || []) as [string, number][], bonus: j.bonus || {} })
  }, [])
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { const t = data.session?.access_token || null; setToken(t); if (t) void load(t); else setMsg('Connecte-toi.') }) }, [load])

  async function trade(sport: string) {
    if (!token || busy) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/packs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'trade', sport }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(j.error || 'Échange impossible'); return }
      setMsg('Pack ' + (SPORT_LABEL[sport] || sport) + ' ajouté à tes packs bonus !')
      await load(token); onChanged?.()
    } finally { setBusy(false) }
  }

  const per = st?.dupesPerPack || 5
  return (
    <div className="pk-modal" role="dialog" aria-modal="true" aria-label="Échanger des doublons" style={{ zIndex: 10000060 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pk-modal-card pk-trade">
        <button type="button" className="pk-modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        <h2>Échanger mes doublons</h2>
        <p>{per} doublons = 1 pack bonus du thème de ton choix. Les doublons les plus communs partent en premier.</p>
        <div className="pk-trade-count"><b>{st?.dupes ?? '…'}</b> doublon{(st?.dupes || 0) > 1 ? 's' : ''} disponible{(st?.dupes || 0) > 1 ? 's' : ''}</div>
        <div className="pk-trade-grid">
          {([['any', 9999], ...(st?.sports || [])] as [string, number][]).map(([sp, n]) => {
            const soon = n < MIN_SPORT_POOL
            return (
              <button key={sp} type="button" disabled={busy || !st || st.dupes < per || soon} onClick={() => void trade(sp)}>
                <b>{SPORT_LABEL[sp] || sp}</b>
                <small>{soon ? 'Bientôt : pas encore assez de cartes' : `${per} doublons → 1 pack${(st?.bonus?.[sp] || 0) > 0 ? ` · tu en as ${st?.bonus?.[sp]}` : ''}`}</small>
              </button>
            )
          })}
        </div>
        {msg && <p className="pk-trade-msg">{msg}</p>}
        {st && st.dupes < per && <p className="pk-trade-msg">Tire des cartes en double pour débloquer des packs bonus.</p>}
      </div>
    </div>
  )
}
