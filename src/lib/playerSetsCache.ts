// get_player_sets (séries d'un joueur parmi ~15 millions de lignes, ~210 ms, 8 % du temps de la base) : résultat gardé 24 h dans le cache de données de Next,
// PARTAGÉ entre toutes les instances du serveur (le cache mémoire de ttlCache.ts, lui, est propre à chaque instance : une nouvelle instance refaisait l'appel).
// Un échec n'est jamais gardé (l'erreur est relancée puis rendue à l'appelant sous la forme { data: null, error }).
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@/lib/supabaseServer'

const run = unstable_cache(
  async (first: string, last: string) => {
    const r = await createServerClient().rpc('get_player_sets', { p_first: first, p_last: last })
    if (r.error) throw Object.assign(new Error(r.error.message || 'get_player_sets'), { code: (r.error as { code?: string }).code })
    return (r.data as any[]) ?? []
  },
  ['get_player_sets_v1'],
  { revalidate: 86400 },
)

export async function getPlayerSetsCached(first: string, last: string): Promise<{ data: any[] | null; error: { message: string; code?: string } | null }> {
  try { return { data: await run(first, last), error: null } }
  catch (e) { return { data: null, error: { message: String((e as Error)?.message || e), code: (e as { code?: string })?.code } } }
}
