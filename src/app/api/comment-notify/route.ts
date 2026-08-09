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

  const { targetUserId, lien } = await req.json()
  if (!targetUserId) return NextResponse.json({ ok: false })
  if (targetUserId === user.id) return NextResponse.json({ ok: true })

  // Valider qu'un commentaire récent existe bien (anti-spam)
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentComment } = await supabaseAdmin
    .from('galerie_comments')
    .select('id, content')
    .eq('author_id', user.id)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()
  if (!recentComment) return NextResponse.json({ error: 'No recent comment found' }, { status: 403 })

  await sendPushToUser(targetUserId, {
    title: '💬 Nouveau commentaire',
    body: (recentComment.content || '').slice(0, 120),
    url: lien,
  })

  return NextResponse.json({ ok: true })
}
