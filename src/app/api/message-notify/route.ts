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

  const { toUserId, senderName } = await req.json()
  if (!toUserId) return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 })

  // Le toUserId n'est pas vérifié par une contrainte DB : sans ce contrôle, n'importe
  // quel compte authentifié pourrait spammer des notifs push vers n'importe qui.
  // On exige la preuve qu'un message a vraiment été envoyé à l'instant vers ce destinataire.
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recentMsg } = await supabaseAdmin.from('messages')
    .select('id').eq('from_user_id', user.id).eq('to_user_id', toUserId).gte('created_at', since).limit(1).maybeSingle()
  if (!recentMsg) return NextResponse.json({ error: 'No recent message found' }, { status: 403 })

  await sendPushToUser(toUserId, {
    title: `💬 ${senderName || 'Nouveau message'}`,
    body: 'Vous avez reçu un message sur Memorabilius',
    url: `/messages?to=${user.id}`,
  })

  return NextResponse.json({ ok: true })
}
