import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser, isChannelAllowed } from '@/lib/pushNotify'
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

  const { toUserId, lien, cardKey } = await req.json()
  if (!toUserId || !cardKey) return NextResponse.json({ error: 'Missing toUserId/cardKey' }, { status: 400 })

  // Verification + marquage atomiques (voir message-notify pour le
  // raisonnement) -- lie precisement le push a CE like, sur CETTE carte,
  // au lieu d'accepter n'importe quel like recent du meme utilisateur.
  const { data: recentLike } = await supabaseAdmin.from('card_likes')
    .update({ notified_push_at: new Date().toISOString() })
    .eq('liker_user_id', user.id).eq('gallery_user_id', toUserId).eq('card_key', cardKey).is('notified_push_at', null)
    .select('card_key').maybeSingle()
  if (!recentLike) return NextResponse.json({ error: 'No recent like found' }, { status: 403 })

  await awardLikeXPIfUnderCap(supabaseAdmin, toUserId)

  const [{ data: profile }, { data: recipientProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', toUserId).single(),
  ])
  const lang = normalizePushLang(recipientProfile?.preferred_lang)
  const likerName = profile?.display_name || someoneNameFallback(lang)
  const { title, body } = likeReceivedPush(lang, likerName)

  // La notif "in-app" (cloche) etait inseree cote client sans jamais verifier
  // les preferences -- desactiver "communaute" n'arretait alors que le push,
  // pas le remplissage de la cloche. Meme garde-fou que sendPushToUser
  // ci-dessous, insere ici plutot que cote client (seul endroit qui peut
  // verifier la preference sans exposer la cle service-role au navigateur).
  if (lien && (await isChannelAllowed(toUserId, 'community'))) {
    await supabaseAdmin.from('notifications').insert({
      user_id: toUserId, type: 'like', message: `${likerName} a aimé votre carte`, lien, lu: false,
    })
  }

  await sendPushToUser(toUserId, {
    title,
    body,
    url: `/galerie/${toUserId}`,
    channelId: 'community',
    imageUrl: recentLike.card_key || undefined,
  })

  return NextResponse.json({ ok: true })
}
