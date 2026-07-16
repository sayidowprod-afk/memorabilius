import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function scoreCard(c: any): number {
  let s = 0
  const m = (c.num || '').match(/\/(\d+)/)
  if (m) s += 10000 / parseInt(m[1])
  if (c.auto)  s += 500
  if (c.rc)    s += 300
  if (c.patch) s += 200
  return s
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const testSecret = req.nextUrl.searchParams.get('secret')
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (testSecret && testSecret === process.env.CRON_SECRET)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const makeUrl = process.env.MAKE_WEEKLY_POST_WEBHOOK
  if (!makeUrl) {
    return NextResponse.json({ error: 'MAKE_WEEKLY_POST_WEBHOOK not set' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memorabilius.vercel.app'
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  // Fetch all data in parallel
  const [{ data: added }, { data: topCards }] = await Promise.all([
    supabase.from('cartes_manuelles').select('user_id').gte('created_at', since.toISOString()),
    supabase.from('cartes_manuelles')
      .select('nom, annee, marque, rc, auto, patch, num, user_id')
      .not('image_recto', 'is', null)
      .gte('created_at', since.toISOString()),
  ])

  // Ranking
  const countByUser = new Map<string, number>()
  ;(added || []).forEach(r => {
    countByUser.set(r.user_id, (countByUser.get(r.user_id) || 0) + 1)
  })
  const topUserIds = [...countByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const { data: profiles } = topUserIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', topUserIds)
    : { data: [] }

  const ranking = topUserIds.map((id, i) => ({
    name: (profiles || []).find(p => p.id === id)?.display_name || 'Collector',
    count: countByUser.get(id) || 0,
    rank: i + 1,
  }))

  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  // Best card of the week for caption
  const bestCard = [...(topCards || [])]
    .map(c => ({ ...c, _score: scoreCard(c) }))
    .sort((a, b) => b._score - a._score)[0]

  const rankLines = ranking
    .map(r => `${medal(r.rank)} ${r.name} — ${r.count} carte${r.count > 1 ? 's' : ''}`)
    .join('\n')

  // --- 3 posts ---

  const posts = [
    {
      type: 'cards',
      image_url: `${baseUrl}/api/cron/weekly-post/image`,
      caption: `🃏 Les plus belles cartes ajoutées cette semaine sur Memorabilius !

${bestCard ? `✨ Mention spéciale : ${bestCard.nom}${bestCard.annee ? ` ${bestCard.annee}` : ''}${bestCard.auto ? ' Auto' : ''}${bestCard.rc ? ' RC' : ''}${bestCard.num ? ` ${(bestCard.num.match(/\/\d+/) || [bestCard.num])[0]}` : ''}` : ''}

Partage tes cartes sur memorabilius.fr 🏀

#memorabilius #cartes #cards #NBA #collection #sportscards`,
    },
    {
      type: 'ranking',
      image_url: `${baseUrl}/api/cron/weekly-post/ranking`,
      caption: `🏆 Classement de la semaine — ${dateStr}

${rankLines || 'Aucune activité cette semaine'}

Rejoins la communauté et monte dans le classement 👇
memorabilius.fr

#memorabilius #classement #cartes #cards #NBA #collection`,
    },
    {
      type: 'collector',
      image_url: `${baseUrl}/api/cron/weekly-post/collector`,
      caption: `⭐ Collectionneur de la semaine : ${ranking[0]?.name || '???'} !

${ranking[0] ? `🏆 ${ranking[0].count} carte${ranking[0].count > 1 ? 's' : ''} ajoutée${ranking[0].count > 1 ? 's' : ''} cette semaine` : ''}

Découvre sa galerie sur memorabilius.fr 🔥

#memorabilius #collectionneur #cartes #cards #NBA #sportscards`,
    },
  ]

  // Send all 3 webhooks
  const results = await Promise.allSettled(
    posts.map(post =>
      fetch(makeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      }).then(r => ({ type: post.type, status: r.status, ok: r.ok }))
    )
  )

  return NextResponse.json({
    ok: true,
    posts: results.map((r, i) => ({
      type: posts[i].type,
      image_url: posts[i].image_url,
      ...(r.status === 'fulfilled' ? r.value : { error: String((r as any).reason) }),
    })),
    ranking,
  })
}
