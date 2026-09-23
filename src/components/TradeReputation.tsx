'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'

// Reputation d'echange d'un membre : echanges termines + note moyenne des
// avis (api/trades/reputation). N'affiche rien tant que le membre n'a aucun
// echange termine ni avis -- pas de "0 echange" decourageant sur un profil neuf.
export default function TradeReputation({ userId }: { userId: string }) {
  const { t } = useLang()
  const [rep, setRep] = useState<{ completed: number; reviewCount: number; average: number | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/trades/reputation?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setRep(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  if (!rep || (rep.completed === 0 && rep.reviewCount === 0)) return null

  return (
    <span title={t('trades_reputation_title')} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800,
      background: 'rgba(27,94,32,0.10)', color: '#1b5e20', borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
    }}>
      🤝 {rep.completed} {t(rep.completed > 1 ? 'trades_reputation_trades_plural' : 'trades_reputation_trades')}
      {rep.average !== null && <span style={{ color: '#b7791f' }}>⭐ {rep.average.toFixed(1)} ({rep.reviewCount})</span>}
    </span>
  )
}
