import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { set_id, player_name, team, variation, card_number, user_id } = await req.json()
    if (!set_id || !player_name || !user_id) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // 1. Chercher une entrée existante pour ce joueur + variation + set
    //    (évite les doublons si TCDB a déjà scrapé cette carte)
    let entryId: number | null = null

    const normStr = (s: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    const { data: existing } = await supabaseAdmin
      .from('card_set_entries')
      .select('id, variation, card_number')
      .eq('set_id', set_id)
      .eq('player_name', player_name)

    if (existing?.length) {
      const cv = normStr(variation)
      // Cherche la meilleure correspondance : variation exacte > card_number > première entrée du joueur
      const match =
        existing.find(e => normStr(e.variation) === cv) ||
        (card_number ? existing.find(e => normStr(e.card_number) === normStr(card_number)) : null) ||
        (cv === '' ? existing.find(e => !e.variation) : null)

      if (match) entryId = match.id
    }

    // 2. Créer l'entrée seulement si aucune correspondance trouvée
    if (!entryId) {
      const { data: entry, error: entryError } = await supabaseAdmin
        .from('card_set_entries')
        .insert({
          set_id,
          player_name,
          team: team || null,
          variation: variation || null,
          card_number: card_number || null,
        })
        .select('id')
        .single()

      if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 })
      entryId = entry.id
    }

    // 3. Placer la carte dans user_set_completion
    const { error: compError } = await supabaseAdmin
      .from('user_set_completion')
      .upsert({ user_id, entry_id: entryId, manually_checked: true }, { onConflict: 'user_id,entry_id' })

    if (compError) return NextResponse.json({ error: compError.message }, { status: 500 })

    return NextResponse.json({ entry_id: entryId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
