// Accès rapides aux cartes via des fonctions SQL (migration 20261130) : la requête directe sur cartes_manuelles est ralentie par la règle de sécurité des cartes privées.
// Chaque fonction est optionnelle : si elle n'existe pas encore (migration non lancée) ou échoue, l'appelant retombe sur sa requête d'origine.
import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000, PARALLEL = 4
const missingUntil = new Map<string, number>()

function noteFailure(fn: string, e: { code?: string; message?: string } | null) {
  if (e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(String(e.message || '')))) missingUntil.set(fn, Date.now() + 600_000)
  else console.log(`[${fn}] échec, repli sur la requête directe :`, e?.message || e)
}

/** Toutes les lignes d'une fonction « setof jsonb » (pages de 1 000, les suivantes 4 par 4). null = fonction absente ou en échec : utiliser l'ancienne requête. */
export async function rpcPaged(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<any[] | null> {
  if (Date.now() < (missingUntil.get(fn) || 0)) return null
  const page = (from: number) => sb.rpc(fn, args).range(from, from + PAGE - 1) as unknown as PromiseLike<{ data: any[] | null; error: any }>
  const first = await page(0)
  if (first.error || !Array.isArray(first.data)) { noteFailure(fn, first.error); return null }
  const out: any[] = [...first.data]
  let from = PAGE, more = first.data.length === PAGE
  while (more) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(from + i * PAGE)))
    more = false
    for (const r of batch) {
      if (r.error || !Array.isArray(r.data)) return null   // page manquante : mieux vaut l'ancienne méthode qu'un résultat incomplet
      out.push(...r.data); if (r.data.length === PAGE) more = true
    }
    from += PARALLEL * PAGE
  }
  return out
}

/** Une seule page d'une fonction « setof jsonb ». null = indisponible. */
export async function rpcOnePage(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<any[] | null> {
  if (Date.now() < (missingUntil.get(fn) || 0)) return null
  const r = await sb.rpc(fn, args)
  if (r.error || !Array.isArray(r.data)) { noteFailure(fn, r.error); return null }
  return r.data as any[]
}

/** Nombre de cartes à vendre, au même format que le décompte direct ({ count, error }). */
export async function countCardsForSale(sb: SupabaseClient): Promise<{ count: number | null; error: any }> {
  if (Date.now() >= (missingUntil.get('count_cards_for_sale') || 0)) {
    const r = await sb.rpc('count_cards_for_sale')
    if (!r.error && r.data != null) return { count: Number(r.data), error: null }
    noteFailure('count_cards_for_sale', r.error)
  }
  const d = await sb.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true)
  return { count: d.count, error: d.error }
}

/** Valeur unique d'une fonction scalaire. ok=false : fonction absente ou en échec (utiliser l'ancienne méthode). */
export async function rpcScalar<T = string>(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; value: T | null }> {
  if (Date.now() < (missingUntil.get(fn) || 0)) return { ok: false, value: null }
  const r = await sb.rpc(fn, args)
  if (r.error) { noteFailure(fn, r.error); return { ok: false, value: null } }
  return { ok: true, value: (r.data ?? null) as T | null }
}
