import { supabase } from '@/lib/supabase'

// Récupère/crée un lien court /c/{id} pour une carte CSV (voir api/csv-shortlink).
// Retombe sur le lien long historique si l'appel échoue (offline, erreur réseau...)
// pour ne jamais bloquer un partage.
export async function getCsvCardSharePath(userId: string, imageUrl: string): Promise<string> {
  const fallback = `/galerie/${userId}?card=${encodeURIComponent(imageUrl)}`
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return fallback
    const r = await fetch('/api/csv-shortlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, imageUrl }),
    })
    if (!r.ok) return fallback
    const { id } = await r.json()
    return id != null ? `/c/${id}` : fallback
  } catch {
    return fallback
  }
}
