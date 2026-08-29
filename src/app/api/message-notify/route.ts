import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { messageReceivedPush, cardSharedPush, normalizePushLang } from '@/lib/pushTranslations'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Meme convention que messages/page.tsx (CARD_PREFIX + JSON) -- dupliquee ici
// plutot que partagee via un module commun, comme les autres prefixes de
// message (IMG_PREFIX, TRADE_OFFER_PREFIX) deja definis localement partout
// ailleurs dans le code.
const CARD_PREFIX = '[[card]]'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { toUserId } = await req.json()
  if (!toUserId) return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 })

  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentMsg } = await supabaseAdmin.from('messages')
    .select('id, contenu').eq('from_user_id', user.id).eq('to_user_id', toUserId).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!recentMsg) return NextResponse.json({ error: 'No recent message found' }, { status: 403 })

  const [{ data: profile }, { data: recipientProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', toUserId).single(),
  ])
  const lang = normalizePushLang(recipientProfile?.preferred_lang)

  let title: string, body: string, imageUrl: string | undefined
  if (recentMsg.contenu?.startsWith(CARD_PREFIX)) {
    try {
      const card = JSON.parse(recentMsg.contenu.slice(CARD_PREFIX.length))
      ;({ title, body } = cardSharedPush(lang, profile?.display_name || null, card.nom || ''))
      imageUrl = card.img || undefined
    } catch {
      ;({ title, body } = messageReceivedPush(lang, profile?.display_name || null))
    }
  } else {
    ;({ title, body } = messageReceivedPush(lang, profile?.display_name || null))
  }

  await sendPushToUser(toUserId, {
    title,
    body,
    url: `/messages?to=${user.id}`,
    channelId: 'messages',
    imageUrl,
  })

  return NextResponse.json({ ok: true })
}
