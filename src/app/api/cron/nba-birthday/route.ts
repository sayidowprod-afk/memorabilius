import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { discordFetch } from '@/lib/discordContest'
import { birthdayChannelId, parisToday, postPublicBirthday, birthdayPickButtons, type BirthdayPlayer } from '@/lib/discordBirthday'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Appele par Vercel Cron une fois par jour (voir vercel.json). Idempotent via
// nba_birthday_posts.post_date (cle primaire) -- un appel repete le meme jour
// (retry, test manuel) ne refait rien.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { dateStr, month, day } = parisToday()

  const { data: existing } = await supabase.from('nba_birthday_posts').select('post_date').eq('post_date', dateStr).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, dateStr, action: 'already_handled' })

  const { data: candidates } = await supabase
    .from('nba_allstar_birthdays')
    .select('id, player_name, birth_date, headshot_url')
    .eq('birth_month', month)
    .eq('birth_day', day)
    .not('headshot_url', 'is', null) // une annonce sans photo n'a pas d'interet ici
    .order('all_star_count', { ascending: false })

  const list = (candidates || []) as BirthdayPlayer[]

  if (list.length === 0) {
    await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'none' })
    return NextResponse.json({ ok: true, dateStr, action: 'none' })
  }

  if (list.length === 1) {
    await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'awaiting_admin' })
    const msg = await postPublicBirthday(supabase, list[0], dateStr)
    return NextResponse.json({ ok: true, dateStr, action: 'posted', player: list[0].player_name, messageId: msg.id })
  }

  // Plusieurs candidats : cree un thread prive sous le channel public (visible
  // seulement par les membres avec un role/permission suffisant sur ce
  // channel -- Discord ne permet pas de cacher un message precis dans un
  // channel normal, voir discussion produit) et laisse un admin choisir via
  // les boutons -- handleBirthdayComponent (api/discord/route.ts) traite le clic.
  const thread = await discordFetch(`/channels/${birthdayChannelId()}/threads`, {
    method: 'POST',
    body: JSON.stringify({ name: `🎂 Anniversaires du ${dateStr}`, type: 12, auto_archive_duration: 1440 }),
  })

  await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'awaiting_admin', thread_id: thread.id })

  await discordFetch(`/channels/${thread.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `🎂 Plusieurs anniversaires marquants aujourd'hui — choisis lequel publier :\n${list.map(p => `• ${p.player_name}`).join('\n')}`,
      components: birthdayPickButtons(dateStr, list),
    }),
  })

  return NextResponse.json({ ok: true, dateStr, action: 'awaiting_admin', candidates: list.map(p => p.player_name) })
}
