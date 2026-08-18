'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES } from '@/lib/badgeDefinitions'
import { computeXP, levelFromXP } from '@/lib/leveling'

// Niveau affiché à côté du pseudo sur la galerie publique — même calcul que
// le dashboard perso (voir leveling.ts), mais recalculé pour le profil
// consulté (statsTotal vient déjà du parent, badges/teams via un fetch dédié).
export default function LevelBadge({ userId, statsTotal }: { userId: string; statsTotal: number }) {
  const [level, setLevel] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_badge_data', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const b = data?.[0]
      const badgesEarned = b ? BADGE_CATEGORIES.reduce((sum, cat) => {
        const v = ({ cartes: b.stat_total, rc: b.stat_rc, patch: b.stat_patch, num: b.stat_num, mois: b.mois_count, views: Number(b.views_count), teams: b.teams_count } as Record<string, number>)[cat.id] ?? 0
        return sum + cat.tiers.filter(t => v >= t.threshold).length
      }, 0) : 0
      setLevel(levelFromXP(computeXP(statsTotal, badgesEarned, b?.teams_count ?? 0)).level)
    })
    return () => { cancelled = true }
  }, [userId, statsTotal])

  if (level == null) return null

  return (
    <span title={`Niveau ${level}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, background: '#003DA6', color: '#fff',
      fontSize: 11, fontWeight: 900, borderRadius: 20, padding: '3px 9px', lineHeight: 1, flexShrink: 0,
    }}>
      ⭐ {level}
    </span>
  )
}
