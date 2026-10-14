import { supabase } from '@/lib/supabase'

export type SetEntryRow = { card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean }

// PostgREST plafonne chaque requete a 1000 lignes : on pagine (les gros sets font 19 000+ cartes avec tous les parallèles).
// Les pages suivantes partent en parallele une fois le total connu.
export async function fetchAllSetEntries(setId: number): Promise<SetEntryRow[]> {
  const cols = 'card_number, player_name, team, variation, is_rc'
  const pageSize = 1000
  const { count } = await supabase.from('card_set_entries').select('id', { count: 'exact', head: true }).eq('set_id', setId)
  const total = Math.min(count ?? 0, 60000)
  const pages = Math.ceil(total / pageSize)
  const out: SetEntryRow[][] = []
  for (let g = 0; g < pages; g += 6) {
    const batch = await Promise.all(Array.from({ length: Math.min(6, pages - g) }, async (_, k) => {
      const from = (g + k) * pageSize
      const { data } = await supabase.from('card_set_entries').select(cols).eq('set_id', setId).order('id', { ascending: true }).range(from, from + pageSize - 1)
      return (data || []) as SetEntryRow[]
    }))
    out.push(...batch)
  }
  return out.flat()
}

// Apercu leger pour le HTML du guide : les cartes de base d'abord (de quoi indexer), le reste est charge apres coup cote navigateur.
export const SET_PREVIEW_SIZE = 250
export async function fetchSetPreview(setId: number): Promise<SetEntryRow[]> {
  const cols = 'card_number, player_name, team, variation, is_rc'
  const { data: base } = await supabase.from('card_set_entries').select(cols).eq('set_id', setId)
    .or('variation.is.null,variation.ilike.base%').order('id', { ascending: true }).range(0, SET_PREVIEW_SIZE - 1)
  if (base && base.length) return base as SetEntryRow[]
  const { data } = await supabase.from('card_set_entries').select(cols).eq('set_id', setId).order('id', { ascending: true }).range(0, SET_PREVIEW_SIZE - 1)
  return (data || []) as SetEntryRow[]
}
