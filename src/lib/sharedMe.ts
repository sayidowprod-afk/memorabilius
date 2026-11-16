// Requêtes « membre connecté » partagées : NavBar, barre du bas, barre du haut, bandeau admin des guides… posaient chacun la même question
// à la base à chaque page (profil, nombre de notifications). Ici elles sont mémorisées quelques instants et les appels simultanés sont regroupés.
import { supabase } from '@/lib/supabase'

type Entry = { at: number; p: Promise<unknown> }
const cache = new Map<string, Entry>()

function memo<T>(key: string, ttlMs: number, fn: () => PromiseLike<T>, force = false): Promise<T> {
  const e = cache.get(key)
  if (!force && e && Date.now() - e.at < ttlMs) return e.p as Promise<T>
  const p = Promise.resolve(fn())
  // un échec n'est jamais gardé : le prochain appel réessaie
  p.catch(() => { if (cache.get(key)?.p === p) cache.delete(key) })
  cache.set(key, { at: Date.now(), p })
  return p
}

/** is_admin + avatar du membre connecté (mémorisés 2 min). */
export function getMyBasics(uid: string): Promise<{ is_admin: boolean | null; avatar_url: string | null } | null> {
  return memo(`me:${uid}`, 120_000, async () => {
    const { data, error } = await supabase.from('profiles').select('is_admin, avatar_url').eq('id', uid).single()
    if (error) throw error
    return (data as { is_admin: boolean | null; avatar_url: string | null } | null) ?? null
  })
}

/** Oublie le profil mémorisé (à appeler après un changement d'avatar). */
export function forgetMyBasics(uid: string) { cache.delete(`me:${uid}`) }

/** Nombre de notifications non lues (mémorisé 4 s : plusieurs composants le demandent au même changement de page). */
export function getUnreadNotifs(uid: string, force = false): Promise<number> {
  return memo(`notifs:${uid}`, 4_000, async () => {
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('lu', false)
    if (error) throw error
    return count || 0
  }, force)
}

let lastSeenAt = 0
/** Marque le membre « en ligne » : au plus une écriture toutes les 3 min (le point vert s'éteint après 5 min). */
export function touchLastSeen(uid: string) {
  if (Date.now() - lastSeenAt < 180_000) return
  lastSeenAt = Date.now()
  void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {}, () => {})
}
