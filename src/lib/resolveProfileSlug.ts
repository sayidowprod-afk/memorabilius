import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_SAFE_RE = /^[a-z0-9-]+$/i
const SUFFIX_RE = /-[0-9a-f]{4}$/i

// Chaque profil a un slug stocké de la forme "{pseudo-slugifié}-{4 premiers
// caractères hex de l'id}" (ex: "fandecookies-36d8") — le suffixe garantit
// l'unicité en base même si deux pseudos slugifient vers la même chaîne (rare
// mais réel : 7 collisions constatées sur 472 profils au moment d'écrire ceci).
// On préfère toujours afficher la forme courte sans suffixe ("fandecookies")
// quand elle ne désigne qu'un seul profil, et on ne retombe sur la forme
// longue que pour les pseudos réellement en collision.
export function stripSlugSuffix(slug: string): string {
  return slug.replace(SUFFIX_RE, '')
}

// Résout le paramètre de route (UUID, pseudo court, ou slug complet avec
// suffixe) vers { id, slug } du profil. Retourne null si rien ne correspond.
export async function resolveProfileBySlugParam(
  supabase: SupabaseClient,
  raw: string
): Promise<{ id: string; slug: string } | null> {
  if (UUID_RE.test(raw)) {
    const { data } = await supabase.from('profiles').select('id, slug').eq('id', raw).maybeSingle()
    return data || null
  }
  const { data: exact } = await supabase.from('profiles').select('id, slug').eq('slug', raw).maybeSingle()
  if (exact) return exact

  // Pseudo court sans suffixe : on ne tente le préfixe qu'après avoir validé
  // que `raw` ne contient aucun caractère spécial ILIKE (%, _) — sinon un
  // visiteur pourrait forger une URL pour sonder l'existence d'autres slugs.
  if (!SLUG_SAFE_RE.test(raw)) return null
  const { data: candidates } = await supabase.from('profiles').select('id, slug').ilike('slug', `${raw}-____`)
  if (candidates && candidates.length === 1) return candidates[0]
  return null
}

// Forme canonique à utiliser pour un lien : le pseudo court si aucun autre
// profil n'a le même, sinon le slug complet (avec suffixe) pour désambiguïser.
export async function canonicalProfileSlug(supabase: SupabaseClient, profileSlug: string): Promise<string> {
  const short = stripSlugSuffix(profileSlug)
  if (short === profileSlug) return profileSlug
  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).ilike('slug', `${short}-____`)
  return (count ?? 0) <= 1 ? short : profileSlug
}
