import type { SupabaseClient } from '@supabase/supabase-js'
import { BADGE_CATEGORIES } from '@/lib/badgeDefinitions'

// Barème XP — événementiel : chaque action écrit une ligne dans xp_events une
// fois, jamais recalculé depuis les totaux courants (voir migration
// 20260819_xp_events.sql). Les cartes rares rapportent plus que les commons,
// pour que la progression reflète la difficulté réelle de la collection.
export const XP_AWARDS = {
  CARD_BASE: 1,
  CARD_RC: 3,
  CARD_AUTO: 5,
  CARD_PATCH: 5,
  CARD_NUM: 3,
  BADGE_UNLOCKED: 15,
  TEAM_JOINED: 20,
  TRADE_COMPLETED: 10,
  LIKE_RECEIVED: 2,
  STREAK_7: 10,
  STREAK_30: 50,
  STREAK_100: 100,
} as const

export function xpForCard(flags: { rc?: boolean; auto?: boolean; patch?: boolean; num?: boolean | string | null }): number {
  let xp: number = XP_AWARDS.CARD_BASE
  if (flags.rc) xp += XP_AWARDS.CARD_RC
  if (flags.auto) xp += XP_AWARDS.CARD_AUTO
  if (flags.patch) xp += XP_AWARDS.CARD_PATCH
  if (flags.num) xp += XP_AWARDS.CARD_NUM
  return xp
}

export async function awardXP(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  amount: number,
  meta?: Record<string, unknown>
) {
  if (amount <= 0) return
  await supabase.from('xp_events').insert({ user_id: userId, type, amount, meta: meta ?? null })
}

// Compare les badges actuellement débloqués à ceux déjà récompensés
// (profiles.xp_badges_seen) et verse +15 XP pour chaque nouveau palier
// franchi — peu importe quelle action l'a fait franchir (carte, team, etc.),
// donc un seul appel après n'importe quelle action qui bouge des stats
// suffit à garder l'XP de badges à jour.
export async function checkAndAwardBadgeXP(supabase: SupabaseClient, userId: string) {
  const [{ data: badgeRows }, { data: profile }] = await Promise.all([
    supabase.rpc('get_user_badge_data', { p_user_id: userId }),
    supabase.from('profiles').select('xp_badges_seen').eq('id', userId).single(),
  ])
  const b = badgeRows?.[0]
  if (!b) return

  const stat: Record<string, number> = {
    cartes: b.stat_total, rc: b.stat_rc, patch: b.stat_patch, num: b.stat_num,
    mois: b.mois_count, views: Number(b.views_count), teams: b.teams_count,
  }
  const earnedIds: string[] = []
  for (const cat of BADGE_CATEGORIES) {
    const v = stat[cat.id] ?? 0
    for (const tier of cat.tiers) if (v >= tier.threshold) earnedIds.push(tier.id)
  }

  const seen: string[] = profile?.xp_badges_seen ?? []
  const seenSet = new Set(seen)
  const newlyEarned = earnedIds.filter(id => !seenSet.has(id))
  if (newlyEarned.length === 0) return

  for (const id of newlyEarned) {
    await awardXP(supabase, userId, 'badge_unlocked', XP_AWARDS.BADGE_UNLOCKED, { badge_id: id })
  }
  await supabase.from('profiles').update({ xp_badges_seen: [...seen, ...newlyEarned] }).eq('id', userId)
}

// Plafonne l'XP de likes à 20 événements/jour (40 XP) pour éviter le farming
// (comptes qui se likent mutuellement en boucle).
export async function awardLikeXPIfUnderCap(supabase: SupabaseClient, userId: string) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const { count } = await supabase.from('xp_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('type', 'like_received').gte('created_at', startOfDay.toISOString())
  if ((count ?? 0) >= 20) return
  await awardXP(supabase, userId, 'like_received', XP_AWARDS.LIKE_RECEIVED)
}
