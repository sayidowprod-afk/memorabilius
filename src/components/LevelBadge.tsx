'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES } from '@/lib/badgeDefinitions'
import { computeXP, levelFromXP, type LevelInfo } from '@/lib/leveling'

// Niveau affiché à côté du pseudo sur la galerie publique — même calcul que
// le dashboard perso (voir leveling.ts), mais recalculé pour le profil
// consulté (statsTotal vient déjà du parent, badges/teams via un fetch dédié).
// Pastille cliquable plutôt qu'un simple title="..." : un hover ne sert à
// rien sur mobile, il faut pouvoir voir la barre XP + l'explication au tap.
export default function LevelBadge({ userId, statsTotal }: { userId: string; statsTotal: number }) {
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [open, setOpen] = useState(false)
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
    if (!open) return
    const onOutside = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  if (!level) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, background: '#003DA6', color: '#fff',
        fontSize: 11, fontWeight: 900, borderRadius: 20, padding: '3px 9px', lineHeight: 1,
        border: 'none', cursor: 'pointer',
      }}>
        ⭐ {level.level}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 240,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 14,
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text, #121212)' }}>Niveau {level.level}</div>
          <div style={{ height: 6, background: 'var(--bg3, #eee)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.round(level.pct * 100)}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3, #999)', marginTop: 4 }}>
            {level.xpIntoLevel} / {level.xpForNextLevel} XP vers le niveau {level.level + 1}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text3, #999)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border, #eee)', lineHeight: 1.5 }}>
            XP gagné : <strong style={{ color: 'var(--text2, #777)' }}>+2</strong> par carte · <strong style={{ color: 'var(--text2, #777)' }}>+15</strong> par badge · <strong style={{ color: 'var(--text2, #777)' }}>+20</strong> par team
          </div>
        </div>
      )}
    </div>
  )
}
