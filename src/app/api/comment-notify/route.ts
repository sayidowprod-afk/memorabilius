import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser, isChannelAllowed } from '@/lib/pushNotify'
import { commentReceivedTitle, normalizePushLang } from '@/lib/pushTranslations'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetUserId, lien, message } = await req.json()
  if (!targetUserId) return NextResponse.json({ ok: false })
  if (targetUserId === user.id) return NextResponse.json({ ok: true })

  // Valider qu'un commentaire récent existe bien (anti-spam). Colonne
  // "content" n'existe pas sur cette table (c'est "message", voir
  // GalerieComments.tsx) -- corrige, le corps du push etait toujours vide.
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentComment } = await supabaseAdmin
    .from('galerie_comments')
    .select('id, message')
    .eq('author_id', user.id)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()
  if (!recentComment) return NextResponse.json({ error: 'No recent comment found' }, { status: 403 })

  const { data: recipientProfile } = await supabaseAdmin
    .from('profiles').select('preferred_lang').eq('id', targetUserId).single()
  const lang = normalizePushLang(recipientProfile?.preferred_lang)

  // Notif "in-app" (cloche) deplacee ici depuis le client -- meme raison que
  // like-notify : c'est le seul endroit capable de verifier la preference
  // "communaute" sans exposer la cle service-role au navigateur.
  if (lien && message && (await isChannelAllowed(targetUserId, 'community'))) {
    await supabaseAdmin.from('notifications').insert({ user_id: targetUserId, type: 'comment', lu: false, message, lien })
  }

  await sendPushToUser(targetUserId, {
    title: commentReceivedTitle(lang),
    body: (recentComment.message || '').slice(0, 120),
    url: lien,
    channelId: 'community',
  })

  return NextResponse.json({ ok: true })
}
