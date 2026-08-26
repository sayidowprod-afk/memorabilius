import type { SupabaseClient } from '@supabase/supabase-js'

// Source de vérité unique pour les droits admin (colonne profiles.is_admin) —
// avant, 8 routes /api/admin/* vérifiaient un Set d'emails codé en dur qui ne
// se synchronisait jamais avec is_admin, donc révoquer un admin via l'UI
// laissait son accès intact sur la moitié de la surface admin.
export async function requireAdmin(admin: SupabaseClient, authHeader: string | null): Promise<{ id: string; email: string } | null> {
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return null

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null

  return { id: user.id, email: user.email ?? '' }
}
