import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { streakWarningPush, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Quotidien en soirée : prévient les utilisateurs avec une série en cours qui
// n'ont pas encore été actifs aujourd'hui, avant qu'ils ne la perdent à minuit.
// Naturellement dédupliqué — le cron ne tourne qu'une fois par soir.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: atRisk } = await supabase
    .from('profiles')
    .select('id, current_streak, preferred_lang')
    .eq('notif_streak_warning', true)
    .gt('current_streak', 0)
    .lt('last_activity_date', today)

  if (!atRisk) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  const sent = { count: 0 }
  const errors: string[] = []

  const processProfile = async (p: { id: string; current_streak: number; preferred_lang?: string }) => {
    try {
      const { title, body } = streakWarningPush(normalizePushLang(p.preferred_lang), p.current_streak)
      await sendPushToUser(p.id, {
        title,
        body,
        url: `/galerie/${p.id}/ajouter`,
        channelId: 'community',
      })
      sent.count++
    } catch (e: any) {
      errors.push(`${p.id}: ${e.message}`)
    }
  }

  const BATCH = 20
  for (let i = 0; i < atRisk.length; i += BATCH) {
    await Promise.all(atRisk.slice(i, i + BATCH).map(processProfile))
  }

  return NextResponse.json({ sent: sent.count, errors })
}
