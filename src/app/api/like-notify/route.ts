import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { toUserId, likerName } = await req.json()
  if (!toUserId) return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 })

  // Exige la preuve qu'un like a vraiment été posé à l'instant vers ce destinataire,
  // sinon n'importe quel compte authentifié pourrait spammer des notifs vers n'importe qui.
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentLike } = await supabaseAdmin.from('card_likes')
    .select('card_key').eq('liker_user_id', user.id).eq('gallery_user_id', toUserId).gte('created_at', since).limit(1).maybeSingle()
  if (!recentLike) return NextResponse.json({ error: 'No recent like found' }, { status: 403 })

  await sendPushToUser(toUserId, {
    title: '❤️ Nouveau like',
    body: `${likerName || 'Quelqu\'un'} a aimé votre carte`,
    url: `/galerie/${toUserId}`,
  })

  return NextResponse.json({ ok: true })
}
