import type { SupabaseClient } from '@supabase/supabase-js'

// Données de badges d'un membre : 5 minutes en mémoire de l'onglet, appels simultanés regroupés.
// (get_user_badge_data pèse lourd sur la base : elle était appelée à chaque ouverture d'une galerie.)
const mem = new Map<string, { t: number; v: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

export async function cachedBadgeData<T = unknown>(supabase: SupabaseClient, userId: string, ttlMs = 300_000): Promise<T | null> {
  const hit = mem.get(userId)
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T
  let p = inflight.get(userId) as Promise<T | null> | undefined
  if (!p) {
    p = (async () => {
      const { data } = await supabase.rpc('get_user_badge_data', { p_user_id: userId })
      const row = (data?.[0] ?? null) as T | null
      if (row) mem.set(userId, { t: Date.now(), v: row })
      return row
    })().finally(() => inflight.delete(userId))
    inflight.set(userId, p)
  }
  return p
}

// compute_user_badges écrit en base et recompte les vues : une fois toutes les 6 heures par membre et par navigateur suffit.
export function shouldComputeBadges(userId: string, ttlMs = 6 * 3600_000): boolean {
  const key = `badges-computed:${userId}`
  try {
    const last = Number(localStorage.getItem(key) || 0)
    if (Date.now() - last < ttlMs) return false
    localStorage.setItem(key, String(Date.now()))
  } catch { /* stockage indisponible : on laisse faire */ }
  return true
}
