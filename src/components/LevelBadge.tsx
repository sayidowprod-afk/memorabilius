'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES } from '@/lib/badgeDefinitions'
import { computeXP, levelFromXP, type LevelInfo } from '@/lib/leveling'

// Niveau affiché à côté du pseudo sur la galerie publique — même calcul que
// le dashboard perso (voir leveling.ts), mais recalculé pour le profil
// consulté (statsTotal vient déjà du parent, badges/teams via un fetch dédié).
export default function LevelBadge({ userId, statsTotal }: { userId: string; statsTotal: number }) {
  const [level, setLevel] = useState<LevelInfo | null>(null)

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

  if (!level) return null

  return (
    <span title={`Niveau ${level.level} — ${level.xpIntoLevel}/${level.xpForNextLevel} XP vers le niveau ${level.level + 1}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ width: 60, height: 7, background: 'var(--bg3, #e5e5e5)', borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.round(level.pct * 100)}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 4 }} />
      </span>
      <span style={{ fontSize: 20, fontWeight: 900, color: '#003DA6', lineHeight: 1 }}>{level.level}</span>
    </span>
  )
}
