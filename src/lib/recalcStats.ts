import { SupabaseClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats, isAllowedCsvUrl, type CardStats } from '@/lib/csvParse'

// Recompte complet et autoritaire des stats d'un profil, a partir des lignes
// reelles de cartes_manuelles (+ CSV externe eventuel) -- jamais d'increment/
// decrement delta. Reutilise par card-added (a chaque ajout/suppression),
// recalc-user (self-serve) et recalcul-stats (cron nightly de rattrapage),
// pour qu'un seul et meme calcul fasse foi partout : un delta qui echoue
// silencieusement une fois cree une derive permanente (le compteur ne se
// corrige jamais tout seul), alors qu'un recompte complet est auto-reparant
// des le prochain appel reussi, quel que soit le nombre d'echecs precedents.
export async function computeUserStats(
  supabase: SupabaseClient,
  userId: string,
  lienCsv: string | null | undefined,
  opts: { csvTimeoutMs?: number } = {}
): Promise<{ stats: CardStats } | { error: string }> {
  const stats: CardStats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

  const hasCsv = !!(lienCsv && isAllowedCsvUrl(lienCsv))
  if (hasCsv) {
    const text = await fetchCsvCapped(lienCsv!, opts.csvTimeoutMs != null
      ? { cache: 'no-store', signal: AbortSignal.timeout(opts.csvTimeoutMs) }
      : undefined)
    // Un CSV configure dont la recuperation echoue ne doit jamais etre traite
    // comme "pas de CSV" -- sinon stats_total est ecrase avec un total
    // tronque (confirme en prod plusieurs fois, voir recalcul-stats).
    if (!text) return { error: 'csv fetch failed' }
    const csvStats = parseCardStats(text)
    stats.total += csvStats.total
    stats.rc += csvStats.rc
    stats.auto += csvStats.auto
    stats.num += csvStats.num
    stats.patch += csvStats.patch
  }

  // Pagination pour bypasser le max_rows=1000 de Supabase. Une page en erreur
  // ne doit jamais etre confondue avec "plus de cartes" (sous-comptage
  // silencieux). .order('id') obligatoire : sans tri explicite, l'ordre entre
  // deux .range() successifs n'est pas garanti par Postgres/PostgREST.
  for (let from = 0; ; from += 1000) {
    const { data: batch, error: batchError } = await supabase
      .from('cartes_manuelles')
      .select('rc, auto, patch, num')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (batchError) return { error: batchError.message }
    if (!batch || batch.length === 0) break
    for (const m of batch) {
      stats.total++
      if (m.rc) stats.rc++
      if (m.auto) stats.auto++
      if (m.patch) stats.patch++
      if (m.num) stats.num++
    }
    if (batch.length < 1000) break
  }

  return { stats }
}

export async function recalcAndSaveUserStats(
  supabase: SupabaseClient,
  userId: string,
  lienCsv: string | null | undefined,
  opts: { csvTimeoutMs?: number } = {}
): Promise<{ stats: CardStats } | { error: string }> {
  const result = await computeUserStats(supabase, userId, lienCsv, opts)
  if ('error' in result) return result
  await supabase.from('profiles').update({
    stats_total: result.stats.total,
    stats_rc: result.stats.rc,
    stats_auto: result.stats.auto,
    stats_num: result.stats.num,
    stats_patch: result.stats.patch,
    stats_updated_at: new Date().toISOString(),
  }).eq('id', userId)
  return result
}
