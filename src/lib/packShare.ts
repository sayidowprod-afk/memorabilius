import { createServerServiceClient } from '@/lib/supabaseServer'
import { RARITY_COLOR, RARITY_NAME, type Rarity } from '@/lib/packs'

export type SharedPull = {
  pseudo: string; rarity: Rarity; rarityName: string; color: string
  player: string; team: string | null; number: string | null; variation: string | null
  rc: boolean; auto: boolean; patch: boolean; run: number | null
  img: string; set: string | null; year: number | null
}

// Carte partagée via /tirage/<id> (lecture seule, côté serveur). Null si le lien n'existe pas.
export async function loadSharedPull(id: string): Promise<SharedPull | null> {
  if (!/^[a-z0-9]{6,20}$/i.test(id)) return null
  const admin = createServerServiceClient()
  const { data: sh } = await admin.from('pack_shares').select('user_id, entry_id').eq('id', id).maybeSingle()
  if (!sh) return null
  const [{ data: c }, { data: p }] = await Promise.all([
    admin.from('pack_pool').select('player_name, team, card_number, variation, is_rc, is_auto, is_patch, print_run, image_url, set_name, set_year, rarity').eq('entry_id', sh.entry_id).maybeSingle(),
    admin.from('profiles').select('display_name').eq('id', sh.user_id).maybeSingle(),
  ])
  if (!c) return null
  const rarity = (c.rarity as Rarity) || 4
  return {
    pseudo: (p?.display_name as string | null) || 'Un collectionneur', rarity, rarityName: RARITY_NAME[rarity], color: RARITY_COLOR[rarity],
    player: c.player_name as string, team: c.team as string | null, number: c.card_number as string | null, variation: c.variation as string | null,
    rc: !!c.is_rc, auto: !!c.is_auto, patch: !!c.is_patch, run: (c.print_run as number | null) ?? null, img: c.image_url as string, set: c.set_name as string | null, year: c.set_year as number | null,
  }
}
