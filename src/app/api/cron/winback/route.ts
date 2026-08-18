import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const INACTIVE_AFTER_DAYS = 12
const RESEND_AFTER_DAYS = 30

// Hebdo : relance les comptes inactifs depuis un moment, plafonné à un envoi
// par mois par personne (last_winback_sent_at) pour ne pas harceler.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const inactiveThreshold = Date.now() - INACTIVE_AFTER_DAYS * 86400_000
  const resendThreshold = Date.now() - RESEND_AFTER_DAYS * 86400_000

  const allUsers: any[] = []
  for (let page = 1; ; page++) {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000, page })
    if (!data || data.users.length === 0) break
    allUsers.push(...data.users)
    if (data.users.length < 1000) break
  }

  const { data: profiles } = await supabase.from('profiles').select('id, last_winback_sent_at, notif_winback')
  if (!profiles) return NextResponse.json({ error: 'No profiles' }, { status: 500 })
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]))

  const eligible = allUsers.filter(u => {
    if (!u.last_sign_in_at) return false
    if (new Date(u.last_sign_in_at).getTime() > inactiveThreshold) return false
    const profile = profileMap.get(u.id)
    if (!profile || !profile.notif_winback) return false
    if (profile.last_winback_sent_at && new Date(profile.last_winback_sent_at).getTime() > resendThreshold) return false
    return true
  })

  const sent = { count: 0 }
  const errors: string[] = []

  const processUser = async (u: any) => {
    try {
      await sendPushToUser(u.id, {
        title: '👋 Ça fait un moment !',
        body: 'Niveaux, streaks, défis hebdo, suivi de collectionneurs… pas mal de choses ont changé depuis ta dernière visite. Reviens voir ta collection !',
        url: '/',
        channelId: 'community',
      })
      await supabase.from('profiles').update({ last_winback_sent_at: new Date().toISOString() }).eq('id', u.id)
      sent.count++
    } catch (e: any) {
      errors.push(`${u.id}: ${e.message}`)
    }
  }

  const BATCH = 20
  for (let i = 0; i < eligible.length; i += BATCH) {
    await Promise.all(eligible.slice(i, i + BATCH).map(processUser))
  }

  return NextResponse.json({ sent: sent.count, errors })
}
