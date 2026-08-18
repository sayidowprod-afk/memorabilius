import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { popularityDigestPush, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Hebdo (dimanche soir) : ne notifie que s'il y a vraiment quelque chose à
// montrer (vues ou likes cette semaine) — pas d'intérêt à relancer avec un
// bilan vide, ça ferait plus fuir que revenir.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const since = weekStart.toISOString()

  const { data: profiles } = await supabase.from('profiles').select('id, preferred_lang').eq('notif_popularity_digest', true)
  if (!profiles) return NextResponse.json({ error: 'No profiles' }, { status: 500 })

  const sent = { count: 0 }
  const errors: string[] = []

  const processProfile = async (p: { id: string; preferred_lang?: string }) => {
    try {
      const [{ count: views }, { count: likes }] = await Promise.all([
        supabase.from('page_views').select('id', { count: 'exact', head: true })
          .ilike('path', `/galerie/${p.id}%`).gte('created_at', since),
        supabase.from('card_likes').select('card_key', { count: 'exact', head: true })
          .eq('gallery_user_id', p.id).gte('created_at', since),
      ])

      if (!views && !likes) return

      const { title, body } = popularityDigestPush(normalizePushLang(p.preferred_lang), views ?? 0, likes ?? 0)

      await sendPushToUser(p.id, {
        title,
        body,
        url: `/galerie/${p.id}`,
        channelId: 'community',
      })
      sent.count++
    } catch (e: any) {
      errors.push(`${p.id}: ${e.message}`)
    }
  }

  const BATCH = 20
  for (let i = 0; i < profiles.length; i += BATCH) {
    await Promise.all(profiles.slice(i, i + BATCH).map(processProfile))
  }

  return NextResponse.json({ sent: sent.count, errors })
}
