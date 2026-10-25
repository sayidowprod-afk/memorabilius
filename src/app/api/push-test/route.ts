import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/pushNotify'
import { createServerServiceClient } from '@/lib/supabaseServer'

const supabaseAdmin = createServerServiceClient()

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return NextResponse.json({ error: 'Aucun abonnement push enregistré pour ce compte. Active les notifications push depuis la page Notifications.' }, { status: 400 })
  }

  try {
    await sendPushToUser(user.id, {
      title: '🔔 Test Memorabilius',
      body: 'Les notifications push fonctionnent !',
      url: '/notifications',
    })
    return NextResponse.json({ ok: true, subs: subs.length })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
