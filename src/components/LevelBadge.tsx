'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES } from '@/lib/badgeDefinitions'
import { computeXP, levelFromXP, type LevelInfo } from '@/lib/leveling'

// Niveau affiché à côté du pseudo sur la galerie publique — même calcul que
// le dashboard perso (voir leveling.ts), mais recalculé pour le profil
// consulté (statsTotal vient déjà du parent, badges/teams via un fetch dédié).
export default function LevelBadge({ userId, statsTotal }: { userId: string; statsTotal: number }) {
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_badge_data', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const b = data?.[0]
      const badgesEarned = b ? BADGE_CATEGORIES.reduce((sum, cat) => {
        const v = ({ cartes: b.stat_total, rc: b.stat_rc, patch: b.stat_patch, num: b.stat_num, mois: b.mois_count, views: Number(b.views_count), teams: b.teams_count } as Record<string, number>)[cat.id] ?? 0
        return sum + cat.tiers.filter(t => v >= t.threshold).length
      }, 0) : 0
      setLevel(levelFromXP(computeXP(statsTotal, badgesEarned, b?.teams_count ?? 0)))
    })
    return () => { cancelled = true }
  }, [userId, statsTotal])

  useEffect(() => {
    if (!showInfo) return
    const onOutside = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowInfo(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [showInfo])

  if (!level) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <div style={{
        display: 'inline-flex', flexDirection: 'column', gap: 4,
        background: 'linear-gradient(135deg, rgba(0,61,166,0.1), rgba(30,99,224,0.04))',
        border: '1px solid rgba(0,61,166,0.2)', borderRadius: 12, padding: '6px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#003DA6', letterSpacing: 0.5 }}>NIVEAU</span>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#003DA6', lineHeight: 1 }}>{level.level}</span>
          <button onClick={() => setShowInfo(v => !v)} aria-label="Comment gagner de l'XP" style={{
            width: 15, height: 15, borderRadius: '50%', border: '1px solid #003DA6', background: 'none',
            color: '#003DA6', fontSize: 9.5, fontWeight: 800, lineHeight: '13px', padding: 0, cursor: 'pointer',
          }}>?</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 58, height: 7, background: 'rgba(0,61,166,0.15)', borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.round(level.pct * 100)}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 4 }} />
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3, #888)', whiteSpace: 'nowrap' }}>
            {level.xpIntoLevel}/{level.xpForNextLevel} XP
          </span>
        </div>
      </div>

      {showInfo && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 220,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 12,
          fontSize: 10.5, color: 'var(--text2, #555)', lineHeight: 1.6,
        }}>
          XP gagné : <strong style={{ color: 'var(--text, #121212)' }}>+2</strong> par carte ajoutée · <strong style={{ color: 'var(--text, #121212)' }}>+15</strong> par badge débloqué · <strong style={{ color: 'var(--text, #121212)' }}>+20</strong> par team rejointe
        </div>
      )}
    </div>
  )
}
