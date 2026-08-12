'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES, TOTAL_BADGES } from '@/lib/badgeDefinitions'

type BadgeData = {
  earned_badges: string[]
  stat_total:  number
  stat_rc:     number
  stat_patch:  number
  stat_num:    number
  mois_count:  number
  views_count: number
  teams_count: number
}

const TIER_STYLES = [
  { bg: 'linear-gradient(145deg,#7c5c2a 0%,#c9872f 45%,#e8a84a 55%,#9a6822 100%)', glow: 'rgba(201,135,47,.6)',  border: '#cd9b2b', textColor: '#fff8e1' },
  { bg: 'linear-gradient(145deg,#4a4a4a 0%,#9e9e9e 45%,#d8d8d8 55%,#6a6a6a 100%)', glow: 'rgba(180,180,180,.5)', border: '#c0c0c0', textColor: '#f5f5f5' },
  { bg: 'linear-gradient(145deg,#7a5b00 0%,#d4a500 45%,#ffe333 55%,#a07000 100%)', glow: 'rgba(255,215,0,.6)',   border: '#ffd700', textColor: '#fffde7' },
  { bg: 'linear-gradient(145deg,#0c4a6e 0%,#0ea5e9 45%,#7dd3fc 55%,#075985 100%)', glow: 'rgba(14,165,233,.55)',border: '#7dd3fc', textColor: '#e0f7ff' },
  { bg: 'linear-gradient(145deg,#3b0764 0%,#a855f7 25%,#e879f9 50%,#818cf8 75%,#3b0764 100%)', glow: 'rgba(168,85,247,.7)', border: '#e879f9', textColor: '#fce7ff', animated: true },
]

function fmtN(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n) }

export default function BadgeBox({ userId }: { userId: string }) {
  const [data, setData]       = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [show, setShow]       = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true); setShow(false)
    supabase.rpc('compute_user_badges', { p_user_id: userId })
      .then(() => supabase.rpc('get_user_badge_data', { p_user_id: userId }))
      .then(({ data: rows }) => {
        if (rows?.[0]) setData(rows[0] as BadgeData)
        setLoading(false)
        requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)))
      })
  }, [userId])

  if (loading) return (
    <div style={{ background: '#0f172a', borderRadius: 16, padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
      Chargement des badges…
    </div>
  )
  if (!data) return null

  const earned     = new Set(data.earned_badges || [])
  const earnedCount = earned.size
  const pct        = Math.round((earnedCount / TOTAL_BADGES) * 100)

  return (
    <div style={{ background: 'linear-gradient(160deg,#0f172a 0%,#1a2744 100%)', borderRadius: 16, border: '1px solid #1e3a5f', boxShadow: '0 8px 40px rgba(0,0,0,.5)', overflow: 'hidden' }}>
      <style>{`
        @keyframes bdg-in { from { opacity:0; transform:translateY(10px) scale(.88) } to { opacity:1; transform:none } }
        @keyframes holo   { 0%,100% { background-position:0% 50% } 50% { background-position:100% 50% } }
        .bdg-card { transition: transform .18s, box-shadow .18s; cursor: default; }
        .bdg-card.earned:hover { transform: translateY(-5px) scale(1.08) !important; }
        .bdg-holo { background-size: 200% 200% !important; animation: holo 3s ease infinite; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🏅</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 15 }}>Badges</div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 1 }}>{earnedCount} / {TOTAL_BADGES} débloqués</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ width: 90, height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#a855f7)', borderRadius: 3, transition: '1.2s ease' }} />
          </div>
          <div style={{ color: '#475569', fontSize: 10 }}>{pct}%</div>
        </div>
      </div>

      {/* Catégories */}
      {BADGE_CATEGORIES.map((cat, catIdx) => {
        const statVal  = (data as unknown as Record<string, number>)[cat.statKey] ?? 0
        const nextTier = cat.tiers.find(t => !earned.has(t.id))
        const allDone  = !nextTier
        const progress = nextTier ? Math.min(statVal / nextTier.threshold, 1) : 1
        const nextStyle = nextTier ? TIER_STYLES[Math.min(cat.tiers.indexOf(nextTier), TIER_STYLES.length - 1)] : null

        return (
          <div key={cat.id} style={{ padding: '14px 16px 12px', borderBottom: '1px solid #0f172a' }}>
            {/* Label ligne */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{cat.emoji}</span>
              <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>{cat.label}</span>
              <span style={{ color: '#475569', fontSize: 11 }}>{fmtN(statVal)} {cat.unit}</span>
            </div>

            {/* Cartes badges */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {cat.tiers.map((tier, tierIdx) => {
                const isEarned = earned.has(tier.id)
                const ts       = TIER_STYLES[Math.min(tierIdx, TIER_STYLES.length - 1)]
                const delay    = show ? (catIdx * 5 + tierIdx) * 45 : 0

                return (
                  <div
                    key={tier.id}
                    className={`bdg-card${isEarned ? ' earned' : ''}${ts.animated && isEarned ? ' bdg-holo' : ''}`}
                    title={isEarned ? `${cat.emoji} ${tier.label} ${cat.unit}` : `Objectif : ${tier.threshold} ${cat.unit}`}
                    style={{
                      width: 62, minWidth: 62, height: 80, borderRadius: 9, flexShrink: 0,
                      background: isEarned ? ts.bg : 'linear-gradient(145deg,#1a2744,#0f172a)',
                      border: `1.5px solid ${isEarned ? ts.border : '#1e3a5f'}`,
                      boxShadow: isEarned ? `0 0 14px ${ts.glow}, 0 3px 10px rgba(0,0,0,.4)` : '0 2px 6px rgba(0,0,0,.3)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      position: 'relative', overflow: 'hidden',
                      opacity: show ? 1 : 0,
                      animation: show ? `bdg-in .4s ease ${delay}ms both` : 'none',
                    }}
                  >
                    {/* Shine sur earned */}
                    {isEarned && (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg,transparent 35%,rgba(255,255,255,.12) 50%,transparent 65%)', pointerEvents: 'none' }} />
                    )}
                    <span style={{ fontSize: isEarned ? 26 : 18, opacity: isEarned ? 1 : 0.15, lineHeight: 1, transition: '.2s' }}>{cat.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: isEarned ? ts.textColor : '#334155', textAlign: 'center', lineHeight: 1.1 }}>
                      {tier.label}
                    </span>
                    {!isEarned && <span style={{ fontSize: 8, color: '#334155' }}>🔒</span>}
                  </div>
                )
              })}
            </div>

            {/* Progress bar vers prochain palier */}
            {!allDone && nextTier && (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#475569' }}>Prochain : {nextTier.threshold} {cat.unit}</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>{fmtN(statVal)} / {fmtN(nextTier.threshold)}</span>
                </div>
                <div style={{ height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress * 100}%`, background: nextStyle?.border ?? '#3b82f6', borderRadius: 2, transition: '1.2s ease' }} />
                </div>
              </div>
            )}
            {allDone && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ Catégorie complétée !</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
