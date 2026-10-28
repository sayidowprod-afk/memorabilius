import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMatchesForOffsets } from '@/lib/pronosMatches'
import { isoDateInParis, offsetFromToday } from '@/lib/pronosDays'
import { XP_AWARDS } from '@/lib/xp'

// Picks conservés 15 jours après le coup d'envoi (voir /api/pronos/resolve) : le cron de résolution
// passe toutes les quelques heures, donc rien n'est perdu même si un utilisateur ne revient pas.
export const PICK_RETENTION_DAYS = 15

async function fetchAllPicks(supabase: SupabaseClient, opts: { userId?: string; sinceDays?: number }) {
  const out: { user_id: string; match_id: string; pick: string; kickoff_at: string }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('pronos_picks').select('user_id, match_id, pick, kickoff_at')
      .lt('kickoff_at', new Date().toISOString()).order('kickoff_at', { ascending: true }).range(from, from + PAGE - 1)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    if (opts.sinceDays) q = q.gte('kickoff_at', new Date(Date.now() - opts.sinceDays * 86400000).toISOString())
    const { data, error } = await q
    if (error || !data) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

// Verse +5 XP par pick gagnant parmi les matchs terminés, pour un utilisateur (appel depuis l'accueil) ou
// pour tous (cron). La correction est toujours recalculée depuis les résultats serveur. Idempotent : l'index
// unique xp_events_pronos_win_unique refuse un second versement pour le même (user, match). Le coup
// d'envoi est enregistré dans meta.kickoff_at pour que les classements se rattachent à la semaine du match
// (et non à la date de versement, qui dépend du moment où l'utilisateur revient sur le site).
export async function resolvePronosWins(supabase: SupabaseClient, opts: { userId?: string; sinceDays?: number } = {}) {
  const picks = await fetchAllPicks(supabase, opts)
  if (picks.length === 0) return { picks: 0, awarded: 0 }

  const offsets = [...new Set(picks.map(p => offsetFromToday(isoDateInParis(new Date(p.kickoff_at)))))]
  const { matches } = await fetchMatchesForOffsets(offsets.length ? offsets : [0])
  const byId = new Map(matches.map(m => [m.id, m]))

  const winners = picks.filter(p => {
    const m = byId.get(p.match_id)
    return !!m && m.status === 'final' && !!m.winner && m.winner === p.pick
  })
  if (winners.length === 0) return { picks: picks.length, awarded: 0 }

  // Évite des centaines d'insertions refusées : on retire d'abord ce qui est déjà versé.
  const already = new Set<string>()
  const ids = [...new Set(winners.map(w => w.match_id))]
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('xp_events').select('user_id, meta')
      .eq('type', 'pronos_win').in('meta->>match_id', ids.slice(i, i + 100))
    for (const r of (data || []) as any[]) already.add(`${r.user_id}|${r.meta?.match_id}`)
  }

  let awarded = 0
  for (const w of winners) {
    if (already.has(`${w.user_id}|${w.match_id}`)) continue
    const { error } = await supabase.from('xp_events').insert({
      user_id: w.user_id, type: 'pronos_win', amount: XP_AWARDS.PRONO_WIN,
      meta: { match_id: w.match_id, kickoff_at: w.kickoff_at },
    })
    if (!error) awarded++ // 23505 (déjà versé en parallèle) => ignoré
  }
  return { picks: picks.length, awarded }
}

export async function purgeOldPicks(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - PICK_RETENTION_DAYS * 86400000).toISOString()
  await supabase.from('pronos_picks').delete().lt('kickoff_at', cutoff)
}
