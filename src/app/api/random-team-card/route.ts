import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Utilise par le bouton "Carte aleatoire" de teams/[teamId]/page.tsx ET par
// le bouton flottant "re-randomiser" de GalerieClient.tsx (visible seulement
// quand on arrive via ce meme flux, voir ?random=1&rerollTeam= dans l'URL) -- une
// seule source de verite pour ne pas dupliquer la logique de tirage.
export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get('teamId')
  if (!teamId) return NextResponse.json({ error: 'teamId manquant' }, { status: 400 })

  const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', teamId)
  const memberIds = (members || []).map(m => m.user_id)
  if (!memberIds.length) return NextResponse.json({ error: 'Equipe vide' }, { status: 404 })

  const [{ data: cards }, { data: privees }] = await Promise.all([
    supabase.from('cartes_manuelles').select('image_recto, user_id')
      .in('user_id', memberIds).not('image_recto', 'is', null).limit(2000),
    supabase.from('cartes_privees').select('user_id, card_key').in('user_id', memberIds),
  ])
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
  const eligible = (cards || []).filter(c => !privateSet.has(`${c.user_id}::${c.image_recto}`))
  if (!eligible.length) return NextResponse.json({ error: 'Aucune carte disponible' }, { status: 404 })

  const pick = eligible[Math.floor(Math.random() * eligible.length)]
  return NextResponse.json({ userId: pick.user_id, imageUrl: pick.image_recto })
}
