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

  // Cinq décomptes côté base (count exact, sans télécharger les lignes) : beaucoup plus léger que lire toutes les cartes par pages de 1000,
  // qui échouait sous charge pour les grosses galeries (statement timeout) et laissait l'ancien total affiché. Un décompte en erreur n'écrase jamais rien.
  const base = () => supabase.from('cartes_manuelles').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const [tot, rc, auto, patch, num] = await Promise.all([
    base(),
    base().eq('rc', true),
    base().eq('auto', true),
    base().eq('patch', true),
    base().not('num', 'is', null).neq('num', ''),
  ])
  for (const r of [tot, rc, auto, patch, num]) if (r.error || r.count == null) return { error: r.error?.message || 'count failed' }
  stats.total += tot.count as number
  stats.rc += rc.count as number
  stats.auto += auto.count as number
  stats.patch += patch.count as number
  stats.num += num.count as number

  return { stats }
}

export async function recalcAndSaveUserStats(
  supabase: SupabaseClient,
  userId: string,
  lienCsv: string | null | undefined,
  opts: { csvTimeoutMs?: number } = {}
): Promise<{ stats: CardStats } | { error: string }> {
  // Plusieurs recomptes peuvent tourner en même temps (ajout en lot : un appel par carte). Chacun horodate son écriture avec son HEURE DE DÉPART
  // et ne remplace que des stats plus anciennes : un recompte parti plus tôt, qui finit en dernier avec un chiffre périmé, ne peut plus écraser le bon total.
  const startedAt = new Date().toISOString()
  const result = await computeUserStats(supabase, userId, lienCsv, opts)
  if ('error' in result) return result
  await supabase.from('profiles').update({
    stats_total: result.stats.total,
    stats_rc: result.stats.rc,
    stats_auto: result.stats.auto,
    stats_num: result.stats.num,
    stats_patch: result.stats.patch,
    stats_updated_at: startedAt,
  }).eq('id', userId).or(`stats_updated_at.is.null,stats_updated_at.lt.${startedAt}`)
  return result
}
