import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Annule une conversion CSV -> cartes manuelles : supprime exactement les
// lignes que CETTE conversion avait creees (pas toutes les cartes du user, il
// a pu en ajouter d'autres depuis) et restaure le lien_csv d'origine.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversionId } = await req.json().catch(() => ({}))

  // Sans id precis : la derniere conversion non annulee de ce profil (cas du
  // bouton "Annuler" affiche juste apres la conversion, avant tout rechargement).
  let query = admin.from('csv_conversions').select('id, lien_csv, card_ids, reverted_at').eq('user_id', user.id)
  query = conversionId ? query.eq('id', conversionId) : query.is('reverted_at', null).order('created_at', { ascending: false }).limit(1)
  const { data: conv } = await query.maybeSingle()
  if (!conv) return NextResponse.json({ error: 'Aucune conversion à annuler.' }, { status: 404 })
  if (conv.reverted_at) return NextResponse.json({ error: 'Cette conversion a déjà été annulée.' }, { status: 409 })

  const ids: string[] = conv.card_ids || []
  if (ids.length) {
    // .in('user_id', ...) en garde-fou : ne supprime que des cartes de ce profil,
    // meme si l'id de conversion venait d'ailleurs.
    const { error } = await admin.from('cartes_manuelles').delete().eq('user_id', user.id).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ne restaure le lien que si le profil n'en a pas defini un nouveau entre-temps
  // -- on ne veut pas ecraser un choix plus recent de l'utilisateur.
  const { data: profile } = await admin.from('profiles').select('lien_csv').eq('id', user.id).single()
  const willRestore = !profile?.lien_csv
  if (willRestore) {
    await admin.from('profiles').update({ lien_csv: conv.lien_csv }).eq('id', user.id)
  }

  await admin.from('csv_conversions').update({ reverted_at: new Date().toISOString() }).eq('id', conv.id)

  return NextResponse.json({ ok: true, removed: ids.length, csvRestored: willRestore, lienCsv: willRestore ? conv.lien_csv : null })
}
