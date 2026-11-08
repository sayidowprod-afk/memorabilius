import type { SupabaseClient } from '@supabase/supabase-js'

// Le compte « demo memorabilius » (profiles.is_demo = true) sert uniquement aux salons : il doit rester totalement invisible des
// autres membres (recherches, classements, échanges, alertes, annuaire, communauté…). Cette fonction donne la liste de ses
// identifiants (gardée 5 min en mémoire) pour l'exclure des requêtes côté serveur qui croisent les membres.
let cache: { at: number; ids: Set<string> } | null = null

export async function demoUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.ids
  const { data } = await supabase.from('profiles').select('id').eq('is_demo', true)
  const ids = new Set<string>((data || []).map((p: { id: string }) => p.id))
  cache = { at: Date.now(), ids }
  return ids
}
