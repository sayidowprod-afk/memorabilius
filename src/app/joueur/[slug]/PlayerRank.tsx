'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Bandeau personnel : « Top x % des collectionneurs de ce joueur ».
// Calculé côté client pour le membre connecté (la page joueur reste en cache pour tout le monde) ; même calcul que les « Top x % » de la galerie.
export default function PlayerRank({ playerName }: { playerName: string }) {
  const [r, setR] = useState<{ pct: number; rank: number; total: number; cards: number; label?: string } | null>(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession(), uid = data.session?.user.id
        if (!uid) return
        const d = await fetch(`/api/player-rank?name=${encodeURIComponent(playerName)}&userId=${encodeURIComponent(uid)}`).then(x => x.json())
        if (!off && d && !d.none) setR(d)
      } catch { /* pas de bandeau si le calcul échoue */ }
    })()
    return () => { off = true }
  }, [playerName])
  if (!r) return null
  return (
    <div style={{ margin: '0 0 var(--sp-4, 16px)', padding: '10px 14px', border: '2px solid #fdb927', background: 'rgba(253,185,39,.1)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <b style={{ fontSize: 24, color: '#fdb927', fontFamily: 'var(--font-display, inherit)' }}>{r.label || `Top ${r.pct} %`}</b>
      <span style={{ fontSize: 13 }}>des collectionneurs de {playerName} · <b>{r.cards} carte{r.cards > 1 ? 's' : ''}</b> · n° {r.rank} sur {r.total}</span>
    </div>
  )
}
