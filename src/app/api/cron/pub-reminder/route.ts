import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { sendPushToUser } from '@/lib/pushNotify'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { PUB_SLOTS } from '@/lib/pubSlots'

const supabase = createServerServiceClient()

// Toutes les 30 minutes : si on est dans une plage de publication conseillée (heure de France), prévient les ADMINS sur leur téléphone
// (« C'est l'heure de poster : TikTok USA »). Une seule alerte par plage et par jour (le lien de la notification porte la date et la plage).
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const minutes = parseInt(get('hour')) * 60 + parseInt(get('minute'))
  const date = get('year') + '-' + get('month') + '-' + get('day')

  // plage : de l'heure conseillée jusqu'à 30 minutes après (un passage du cron toutes les 30 min suffit, la déduplication évite les doublons)
  const due = PUB_SLOTS.filter(s => s.days.includes(dayIdx) && minutes >= s.hour * 60 + s.min && minutes < s.hour * 60 + s.min + 30)
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 })

  const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true)
  let sent = 0
  for (const slot of due) {
    const tag = '#pub-' + date + '-' + slot.id
    for (const a of admins || []) {
      const { data: already } = await supabase.from('notifications').select('id').eq('user_id', a.id).eq('type', 'pub_reminder').like('lien', '%' + tag).limit(1)
      if (already?.length) continue
      const message = 'C’est l’heure de publier : ' + slot.pays + ' (' + slot.local + ').'
      const lien = '/admin/pub' + tag
      const { error } = await supabase.from('notifications').insert({ user_id: a.id, type: 'pub_reminder', message, lien, lu: false })
      if (error) continue
      await Promise.allSettled([sendPushToUser(a.id, { title: 'À publier maintenant', body: message, url: lien, channelId: 'community' })])
      sent++
    }
  }
  return NextResponse.json({ ok: true, sent })
}
