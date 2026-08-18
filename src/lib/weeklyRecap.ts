import type { SupabaseClient } from '@supabase/supabase-js'

export interface WeeklyCollector { id: string; name: string; avatarUrl: string | null; count: number }
export interface WeeklyCard { image: string; name: string; likes: number }

// Classement (le plus de cartes ajoutées cette semaine) + belles cartes (le
// plus de likes reçus cette semaine) — calculé depuis les tables existantes,
// pas de nouvelle table de suivi nécessaire.
export async function computeWeeklyRecap(supabase: SupabaseClient, weekStart: Date, weekEnd: Date) {
  const [{ data: cards }, { data: likes }] = await Promise.all([
    supabase.from('cartes_manuelles').select('user_id')
      .gte('created_at', weekStart.toISOString()).lt('created_at', weekEnd.toISOString()),
    supabase.from('card_likes').select('card_key')
      .gte('created_at', weekStart.toISOString()).lt('created_at', weekEnd.toISOString()),
  ])

  const countsByUser = new Map<string, number>()
  ;(cards || []).forEach((c: any) => countsByUser.set(c.user_id, (countsByUser.get(c.user_id) || 0) + 1))
  const topUserIds = [...countsByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const countsByCard = new Map<string, number>()
  ;(likes || []).forEach((l: any) => countsByCard.set(l.card_key, (countsByCard.get(l.card_key) || 0) + 1))
  const topCardKeys = [...countsByCard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const [{ data: profiles }, { data: cardRows }] = await Promise.all([
    topUserIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', topUserIds.map(([id]) => id))
      : Promise.resolve({ data: [] as any[] }),
    topCardKeys.length
      ? supabase.from('cartes_manuelles').select('nom, image_recto').in('image_recto', topCardKeys.map(([k]) => k))
      : Promise.resolve({ data: [] as any[] }),
  ])

  const topCollectors: WeeklyCollector[] = topUserIds.map(([id, count]) => {
    const p = (profiles || []).find((pr: any) => pr.id === id)
    return { id, name: p?.display_name || 'Collectionneur', avatarUrl: p?.avatar_url || null, count }
  })

  const topCards: WeeklyCard[] = topCardKeys
    .map(([key, likeCount]) => {
      const c = (cardRows || []).find((cr: any) => cr.image_recto === key)
      return { image: key, name: c?.nom || '', likes: likeCount }
    })
    .filter(c => c.name)

  return { topCollectors, topCards }
}
