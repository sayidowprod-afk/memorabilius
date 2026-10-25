import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/pushNotify'
import { popularityDigestPush, normalizePushLang } from '@/lib/pushTranslations'
import { createServerServiceClient } from '@/lib/supabaseServer'

const supabase = createServerServiceClient()

// Hebdo (dimanche soir) : ne notifie que s'il y a vraiment quelque chose à
// montrer (vues ou likes cette semaine) — pas d'intérêt à relancer avec un
// bilan vide, ça ferait plus fuir que revenir.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const since = weekStart.toISOString()

  const { data: profiles } = await supabase.from('profiles').select('id, preferred_lang').eq('notif_popularity_digest', true)
  if (!profiles) return NextResponse.json({ error: 'No profiles' }, { status: 500 })

  // Avant : 1 requete page_views + 1 requete card_likes PAR profil (ILIKE
  // '/galerie/<id>%' sur toute la fenetre de 7 jours a chaque fois -- jusqu'a
  // ~420ms/profil mesure en prod, soit plusieurs minutes de scan DB repete
  // pour la meme fenetre temporelle). Les deux tables sont lues UNE SEULE
  // fois ici, regroupees par profil cote JS -- resultat identique, cout DB
  // divise par ~N (N = nb de profils abonnes a ce digest).
  const [{ data: viewRows }, { data: likeRows }] = await Promise.all([
    supabase.from('page_views').select('path').ilike('path', '/galerie/%').gte('created_at', since),
    supabase.from('card_likes').select('gallery_user_id').gte('created_at', since),
  ])

  const viewsByUser = new Map<string, number>()
  for (const r of viewRows ?? []) {
    const id = r.path?.split('/')[2]
    if (id) viewsByUser.set(id, (viewsByUser.get(id) ?? 0) + 1)
  }
  const likesByUser = new Map<string, number>()
  for (const r of likeRows ?? []) {
    if (r.gallery_user_id) likesByUser.set(r.gallery_user_id, (likesByUser.get(r.gallery_user_id) ?? 0) + 1)
  }

  const sent = { count: 0 }
  const errors: string[] = []

  const processProfile = async (p: { id: string; preferred_lang?: string }) => {
    try {
      const views = viewsByUser.get(p.id) ?? 0
      const likes = likesByUser.get(p.id) ?? 0

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
