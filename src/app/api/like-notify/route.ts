import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { awardLikeXPIfUnderCap } from '@/lib/xp'
import { likeReceivedPush, someoneNameFallback, normalizePushLang } from '@/lib/pushTranslations'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { toUserId } = await req.json()
  if (!toUserId) return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 })

  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentLike } = await supabaseAdmin.from('card_likes')
    .select('card_key').eq('liker_user_id', user.id).eq('gallery_user_id', toUserId).gte('created_at', since).limit(1).maybeSingle()
  if (!recentLike) return NextResponse.json({ error: 'No recent like found' }, { status: 403 })

  await awardLikeXPIfUnderCap(supabaseAdmin, toUserId)

  const [{ data: profile }, { data: recipientProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', toUserId).single(),
  ])
  const lang = normalizePushLang(recipientProfile?.preferred_lang)
  const { title, body } = likeReceivedPush(lang, profile?.display_name || someoneNameFallback(lang))

  await sendPushToUser(toUserId, {
    title,
    body,
    url: `/galerie/${toUserId}`,
    channelId: 'community',
    imageUrl: recentLike.card_key || undefined,
  })

  return NextResponse.json({ ok: true })
}
