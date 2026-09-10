import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { discordFetch } from '@/lib/discordContest'
import { birthdayChannelId, parisToday, postPublicBirthday, postTestBirthday, birthdayPickButtons, groupCandidatesBySport, type BirthdayPlayer } from '@/lib/discordBirthday'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Appele par Vercel Cron une fois par jour (voir vercel.json). Idempotent via
// nba_birthday_posts.post_date (cle primaire) -- un appel repete le meme jour
// (retry, test manuel) ne refait rien. Anciennement NBA seule, couvre
// desormais 5 sports (nba/nfl/baseball/hockey/football) puises dans le meme
// pool quotidien -- voir sports_birthdays.sport.
//
// Test manuel sur un autre serveur/channel Discord : ?channelId=XXXX poste sur
// ce channel au lieu du channel prod (DISCORD_BIRTHDAY_CHANNEL_ID). post_date
// est une colonne SQL `date` -- un run de test ne peut donc jamais y ecrire de
// cle propre (un suffixe "-test" essaye plus tot echouait silencieusement a
// l'insert, cassant tout le flux de test) et ecrire la vraie date
// corromprait la ligne de production du jour. Un run de test ne touche donc
// JAMAIS nba_birthday_posts : ni lecture d'idempotence, ni insert -- les
// boutons du thread encodent le channelId directement dans leur custom_id
// (prefixe "bdaytest:", voir handleBirthdayTestComponent dans
// api/discord/route.ts) puisqu'il n'y a pas de ligne DB a consulter au clic.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const testChannelId = req.nextUrl.searchParams.get('channelId')
  const channelId = testChannelId || birthdayChannelId()
  const { dateStr, month, day } = parisToday()

  if (!testChannelId) {
    const { data: existing } = await supabase.from('nba_birthday_posts').select('post_date').eq('post_date', dateStr).maybeSingle()
    if (existing) return NextResponse.json({ ok: true, dateStr, action: 'already_handled' })
  }

  const { data: candidates } = await supabase
    .from('sports_birthdays')
    .select('id, player_name, birth_date, headshot_url, sport')
    .eq('birth_month', month)
    .eq('birth_day', day)
    .not('headshot_url', 'is', null) // une annonce sans photo n'a pas d'interet ici
    .order('all_star_count', { ascending: false })

  const list = (candidates || []) as BirthdayPlayer[]

  if (list.length === 0) {
    if (!testChannelId) await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'none' })
    return NextResponse.json({ ok: true, dateStr, action: 'none', test: !!testChannelId })
  }

  if (list.length === 1) {
    if (!testChannelId) await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'awaiting_admin' })
    const msg = testChannelId
      ? await postTestBirthday(list[0], dateStr, channelId)
      : await postPublicBirthday(supabase, list[0], dateStr, channelId)
    return NextResponse.json({ ok: true, dateStr, action: 'posted', player: list[0].player_name, messageId: msg.id, test: !!testChannelId })
  }

  // Plusieurs candidats : cree un thread prive sous le channel public (visible
  // seulement par les membres avec un role/permission suffisant sur ce
  // channel -- Discord ne permet pas de cacher un message precis dans un
  // channel normal, voir discussion produit) et laisse un admin choisir via
  // les boutons -- handleBirthdayComponent / handleBirthdayTestComponent
  // (api/discord/route.ts) traitent le clic.
  const thread = await discordFetch(`/channels/${channelId}/threads`, {
    method: 'POST',
    body: JSON.stringify({ name: `🎂 Anniversaires du ${dateStr}${testChannelId ? '-test' : ''}`, type: 12, auto_archive_duration: 1440 }),
  })

  if (!testChannelId) await supabase.from('nba_birthday_posts').insert({ post_date: dateStr, status: 'awaiting_admin', thread_id: thread.id })

  await discordFetch(`/channels/${thread.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `🎂 Plusieurs anniversaires marquants aujourd'hui — choisis lequel publier :\n\n${groupCandidatesBySport(list)}`,
      components: birthdayPickButtons(testChannelId ? `bdaytest:${channelId}` : `bday:${dateStr}`, list),
    }),
  })

  return NextResponse.json({ ok: true, dateStr, action: 'awaiting_admin', candidates: list.map(p => p.player_name), test: !!testChannelId })
}
