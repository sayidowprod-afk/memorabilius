import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

const admin = createServerServiceClient()
const HIDE_AT = 2   // nombre de membres différents qui doivent signaler la même photo pour la retirer

// POST { entryId, imageUrl } : « cette photo n'est pas la bonne pour cette ligne ».
// Au 2e membre différent, la photo est retirée de la ligne (image mémorisée supprimée) et ne sera plus proposée pour cette ligne.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'photo-report', 40, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const entryId = Number(body?.entryId)
  const imageUrl = String(body?.imageUrl || '').slice(0, 1000)
  if (!entryId || !imageUrl) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { error } = await admin.from('setlist_photo_reports').upsert(
    { entry_id: entryId, image_url: imageUrl, user_id: user.id },
    { onConflict: 'entry_id,image_url,user_id', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const { count } = await admin.from('setlist_photo_reports').select('id', { count: 'exact', head: true }).eq('entry_id', entryId).eq('image_url', imageUrl)
  let hidden = false
  if ((count || 0) >= HIDE_AT) {
    await admin.from('card_set_entries').update({ image_url: null }).eq('id', entryId).eq('image_url', imageUrl)
    await admin.from('entry_images').delete().eq('entry_id', entryId).eq('image_url', imageUrl)
    hidden = true
  }
  return NextResponse.json({ ok: true, hidden })
}
