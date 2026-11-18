import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

export const maxDuration = 15
const admin = createServerServiceClient()

// POST { entryId } -> { url } : lien court d'un beau tirage (épique ou légendaire), à coller n'importe où (Discord affiche alors la carte en aperçu).
// Garde-fou : il faut avoir réellement tiré cette carte.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'packs-share', 20, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const entryId = Number(body?.entryId)
  if (!Number.isFinite(entryId)) return NextResponse.json({ error: 'Carte inconnue' }, { status: 400 })

  const [{ data: mine }, { data: card }] = await Promise.all([
    admin.from('user_pack_cards').select('entry_id').eq('user_id', user.id).eq('entry_id', entryId).maybeSingle(),
    admin.from('pack_pool').select('rarity').eq('entry_id', entryId).maybeSingle(),
  ])
  if (!mine || !card) return NextResponse.json({ error: 'Tu n’as pas tiré cette carte.' }, { status: 403 })
  if ((card.rarity as number) < 4) return NextResponse.json({ error: 'Seules les cartes épiques et légendaires se partagent.' }, { status: 400 })

  let { data: share } = await admin.from('pack_shares').select('id').eq('user_id', user.id).eq('entry_id', entryId).maybeSingle()
  if (!share) {
    const ins = await admin.from('pack_shares').insert({ user_id: user.id, entry_id: entryId }).select('id').single()
    if (ins.error) {
      // deux clics rapprochés : l'autre requête a créé le lien entre-temps
      const again = await admin.from('pack_shares').select('id').eq('user_id', user.id).eq('entry_id', entryId).maybeSingle()
      share = again.data
    } else share = ins.data
  }
  if (!share) return NextResponse.json({ error: 'Impossible de créer le lien.' }, { status: 500 })
  return NextResponse.json({ url: `https://www.memorabilius.fr/tirage/${share.id}` })
}
