// Cartes manuelles d'un joueur (toutes, sans plafond) pour la page joueur et /api/player-cards.
// Avant : pages de 1 000 lignes lues UNE PAR UNE, chacune avec tri + jointure sur profiles -> plus de 10 s pour un joueur très collectionné (Michael Jordan).
// Maintenant : la 1re page seule ; si elle est pleine, les suivantes sont demandées 4 par 4 EN PARALLÈLE. Le tri par date se fait ici, en mémoire.
import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000, PARALLEL = 4
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function withRetry<T extends { error: any }>(run: () => PromiseLike<T>, label: string): Promise<T> {
  let r = await run()
  // un dépassement de délai (57014) n'est PAS relancé : refaire la même requête lente trois fois triplait la charge de la base quand elle était déjà saturée
  for (let t = 0; r.error && t < 2 && (r.error as { code?: string }).code !== '57014'; t++) { console.log(`[${label}] erreur, nouvelle tentative :`, r.error.message || r.error); await sleep(500 * (t + 1)); r = await run() }
  if (r.error) console.log(`[${label}] échec définitif :`, r.error.message || r.error)
  return r
}

export async function fetchPlayerManuelles(sb: SupabaseClient, select: string, firstName: string, lastName: string): Promise<any[]> {
  const page = (from: number) => withRetry(() => sb.from('cartes_manuelles').select(select)
    .ilike('nom', `%${firstName}%`).ilike('nom', `%${lastName}%`)
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })                                   // ordre stable pour la pagination ; le tri par date est refait plus bas
    .range(from, from + PAGE - 1), 'cartes joueur')
  const out: any[] = []
  // 1re requête SANS tri : avec « ORDER BY created_at DESC LIMIT », la base parcourt l'index des dates en filtrant au lieu d'utiliser l'index des noms (1,9 s en moyenne, 24 % du temps total de la base).
  // La très grande majorité des joueurs a moins de 1 000 cartes : une seule requête rapide suffit, le tri par date est fait en mémoire plus bas.
  // Au-delà de 1 000 résultats, on repasse par la pagination triée ci-dessous (ordre stable).
  let first: { data: any[] | null; error: any } = await withRetry(() => sb.from('cartes_manuelles').select(select)
    .ilike('nom', `%${firstName}%`).ilike('nom', `%${lastName}%`).not('image_recto', 'is', null).limit(PAGE), 'cartes joueur')
  if (!first.error && first.data && first.data.length === PAGE) first = await page(0)
  if (first.error || !first.data) {
    // « prénom ET nom » dépasse le délai de la base : plan plus simple avec le nom de famille seul, le prénom est filtré ensuite par l'appelant
    console.log('[cartes joueur] repli sur le nom de famille seul')
    const fb = (from: number) => sb.from('cartes_manuelles').select(select).ilike('nom', `%${lastName}%`).not('image_recto', 'is', null).range(from, from + PAGE - 1)
    const r = await fb(0)
    if (r.error || !r.data) { console.log('[cartes joueur] repli en échec :', r.error?.message); return out }
    first = r as { data: any[] | null; error: any }
  }
  const rows0 = first.data as any[]
  out.push(...rows0)
  let from = PAGE, more = rows0.length === PAGE
  while (more) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(from + i * PAGE)))
    more = false
    for (const r of batch) { if (r.error || !r.data?.length) continue; out.push(...r.data); if (r.data.length === PAGE) more = true }
    from += PARALLEL * PAGE
  }
  return out.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

// Version générique : `page(from)` renvoie la page de 1 000 lignes commençant à `from`. 1re page seule, puis les suivantes 4 par 4 en parallèle.
export async function fetchAllPaged(page: (from: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const out: any[] = []
  const first = await withRetry(() => page(0), 'cartes paginées')
  if (first.error || !first.data) return out
  out.push(...first.data)
  let from = PAGE, more = first.data.length === PAGE
  while (more) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => withRetry(() => page(from + i * PAGE), 'cartes paginées')))
    more = false
    for (const r of batch) { if (r.error || !r.data?.length) continue; out.push(...r.data); if (r.data.length === PAGE) more = true }
    from += PARALLEL * PAGE
  }
  return out
}
