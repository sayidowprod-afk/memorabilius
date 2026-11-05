import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSorties, SORTIES_SOURCE } from '@/lib/sortiesProduits'

export type SortiesRefresh = { ok: true; read: number } | { ok: false; status: number; error: string }

// Relit le calendrier public des sorties de cartes de basket et met à jour la table card_releases.
// Partagé par le contrôle hebdomadaire (cron) et le bouton « Actualiser » de l'admin. Une seule requête HTTP, aucun appel payant.
export async function refreshSorties(supabase: SupabaseClient): Promise<SortiesRefresh> {
  let html = ''
  try {
    const r = await fetch(SORTIES_SOURCE.url, { headers: { 'User-Agent': 'MemorabiliusBot/1.0 (+https://www.memorabilius.fr)' }, cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!r.ok) return { ok: false, status: 502, error: `Le site source a répondu ${r.status}.` }
    html = await r.text()
  } catch (e) {
    return { ok: false, status: 502, error: `Site source injoignable (${e instanceof Error ? e.message : 'erreur réseau'}).` }
  }

  const sorties = parseSorties(html)
  if (sorties.length === 0) return { ok: false, status: 422, error: 'Aucune sortie lue : la page source a peut-être changé de forme. Rien n’a été modifié.' }

  const rows = sorties.map(s => ({ name: s.name, release_date: s.date, formats: s.formats, source: SORTIES_SOURCE.id, source_url: s.url, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('card_releases').upsert(rows, { onConflict: 'name,release_date' })
  if (error) {
    const missing = /card_releases|relation|does not exist|schema cache/i.test(error.message)
    return { ok: false, status: 500, error: missing ? 'La table du calendrier n’existe pas encore : lance d’abord la migration « 20261107_sorties_produits ».' : error.message }
  }

  // ménage : les sorties passées depuis plus de 60 jours ne servent plus
  const limit = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  await supabase.from('card_releases').delete().lt('release_date', limit)
  return { ok: true, read: sorties.length }
}
