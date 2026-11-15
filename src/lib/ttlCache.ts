// Petit cache mémoire avec durée de vie, pour les routes serveur : une même recherche (liste des cartes d'un joueur ou d'une équipe) n'est faite en base qu'UNE fois
// à chaque instance, au lieu d'être refaite à chaque défilement ou changement de filtre. Les appels simultanés partagent la même requête.
const store = new Map<string, { at: number; ttl: number; p: Promise<unknown> }>()
const MAX = 200

export async function cachedAsync<T>(key: string, ttlMs: number | ((v: T) => number), fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.p as Promise<T>
  const entry = { at: Date.now(), ttl: 30_000, p: undefined as unknown as Promise<unknown> }
  entry.p = fn().then(v => { entry.ttl = typeof ttlMs === 'function' ? ttlMs(v) : ttlMs; entry.at = Date.now(); return v }, err => { store.delete(key); throw err })
  store.set(key, entry)
  if (store.size > MAX) { const first = store.keys().next().value; if (first && first !== key) store.delete(first) }
  return entry.p as Promise<T>
}
