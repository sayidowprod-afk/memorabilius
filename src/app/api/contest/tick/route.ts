import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { discordFetch, contestChannelId, parisWeekStart, parisNow, pickThemes, themeVoteButtons, entryVoteButton } from '@/lib/discordContest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Appele par un cron externe (GitHub Actions, voir .github/workflows/contest-cron.yml)
// toutes les heures -- chaque etape est gardee par le statut en base, donc un
// appel repete dans la meme fenetre horaire ne refait rien (idempotent).
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CONTEST_CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { weekday, hour } = parisNow()
  const weekStart = parisWeekStart()
  const actions: string[] = []

  if (weekday === 'Mon' && hour >= 8 && hour < 12) {
    const { data: existing } = await supabase.from('contest_weeks').select('id').eq('week_start', weekStart).maybeSingle()
    if (!existing) { await openThemeVote(weekStart); actions.push('theme_vote_opened') }
  }

  if (weekday === 'Mon' && hour >= 18 && hour < 22) {
    const { data: week } = await supabase.from('contest_weeks').select('*').eq('week_start', weekStart).eq('status', 'theme_voting').maybeSingle()
    if (week) { await closeThemeVote(week); actions.push('theme_vote_closed') }
  }

  if (weekday === 'Fri' && hour >= 8 && hour < 12) {
    const { data: week } = await supabase.from('contest_weeks').select('*').eq('week_start', weekStart).eq('status', 'submission_open').maybeSingle()
    if (week) { await openEntryVote(week); actions.push('entry_vote_opened') }
  }

  if (weekday === 'Fri' && hour >= 18 && hour < 22) {
    const { data: week } = await supabase.from('contest_weeks').select('*').eq('week_start', weekStart).eq('status', 'entry_voting').maybeSingle()
    if (week) { await closeEntryVote(week); actions.push('entry_vote_closed') }
  }

  return NextResponse.json({ ok: true, weekday, hour, weekStart, actions })
}

async function openThemeVote(weekStart: string) {
  const themes = await pickThemes(supabase, 4)
  if (themes.length < 2) return // pool trop petit pour un vote, on attend d'en ajouter

  const { data: week } = await supabase.from('contest_weeks')
    .insert({ week_start: weekStart, status: 'theme_voting', theme_option_ids: themes.map(t => t.id), theme_vote_channel_id: contestChannelId() })
    .select().single()
  if (!week) return

  const msg = await discordFetch(`/channels/${contestChannelId()}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: '🗳️ Vote du thème de la semaine',
        description: themes.map((t, i) => `**${i + 1}.** ${t.label}`).join('\n') + '\n\nVotez avant 18h ! (1 vote par personne, changeable)',
        color: 0x003DA6,
      }],
      components: themeVoteButtons(week.id, themes),
    }),
  })

  await supabase.from('contest_weeks').update({ theme_vote_message_id: msg.id }).eq('id', week.id)
}

async function closeThemeVote(week: any) {
  const { data: votes } = await supabase.from('contest_theme_votes').select('theme_id').eq('week_id', week.id)
  const tally = new Map<string, number>()
  for (const v of votes || []) tally.set(v.theme_id, (tally.get(v.theme_id) || 0) + 1)

  const themeIds: string[] = week.theme_option_ids
  let winnerId = themeIds[0]
  let winnerCount = -1
  for (const id of themeIds) {
    const c = tally.get(id) || 0
    if (c > winnerCount) { winnerCount = c; winnerId = id }
  }

  const { data: winnerTheme } = await supabase.from('contest_themes').select('*').eq('id', winnerId).single()
  await supabase.from('contest_themes').update({ active: true, times_used: (winnerTheme?.times_used || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', winnerId)
  await supabase.from('contest_weeks').update({ status: 'submission_open', winning_theme_id: winnerId }).eq('id', week.id)

  if (week.theme_vote_message_id) {
    await discordFetch(`/channels/${contestChannelId()}/messages/${week.theme_vote_message_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ components: [] }),
    }).catch(() => {})
  }

  await discordFetch(`/channels/${contestChannelId()}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: '🏆 Thème de la semaine',
        description: `**${winnerTheme?.label}** (${winnerCount} vote${winnerCount > 1 ? 's' : ''})\n\nPostez votre carte avec \`/concours-participer\` avant jeudi soir !`,
        color: 0xf39c12,
      }],
    }),
  })
}

async function openEntryVote(week: any) {
  const { data: entries } = await supabase.from('contest_entries').select('*').eq('week_id', week.id)

  if (!entries?.length) {
    await supabase.from('contest_weeks').update({ status: 'closed' }).eq('id', week.id)
    await discordFetch(`/channels/${contestChannelId()}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: '😢 Aucune participation cette semaine — on retente la semaine prochaine !' }),
    })
    return
  }

  await discordFetch(`/channels/${contestChannelId()}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: `🗳️ **Vote des participations !** ${entries.length} carte${entries.length > 1 ? 's' : ''} en lice — votez ci-dessous avant 18h.` }),
  })

  for (const entry of entries) {
    const msg = await discordFetch(`/channels/${contestChannelId()}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [{
          description: `Participation de **${entry.discord_username || 'un membre'}**`,
          image: { url: entry.image_url },
          color: 0x003DA6,
        }],
        components: entryVoteButton(week.id, entry.id),
      }),
    })
    await supabase.from('contest_entries').update({ message_id: msg.id }).eq('id', entry.id)
  }

  await supabase.from('contest_weeks').update({ status: 'entry_voting', entry_vote_started_at: new Date().toISOString() }).eq('id', week.id)
}

async function closeEntryVote(week: any) {
  const { data: entries } = await supabase.from('contest_entries').select('*').eq('week_id', week.id)
  const { data: votes } = await supabase.from('contest_entry_votes').select('entry_id').eq('week_id', week.id)

  const tally = new Map<string, number>()
  for (const v of votes || []) tally.set(v.entry_id, (tally.get(v.entry_id) || 0) + 1)

  let winner: any = null
  let winnerCount = -1
  for (const e of entries || []) {
    const c = tally.get(e.id) || 0
    if (c > winnerCount) { winnerCount = c; winner = e }
  }

  await supabase.from('contest_weeks').update({ status: 'closed', winning_entry_id: winner?.id || null }).eq('id', week.id)

  const ranking = (entries || [])
    .map(e => ({ e, c: tally.get(e.id) || 0 }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10)
    .map((r, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} **${r.e.discord_username || 'un membre'}** — ${r.c} vote${r.c > 1 ? 's' : ''}`)
    .join('\n')

  await discordFetch(`/channels/${contestChannelId()}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: '🏆 Résultat du concours de la semaine',
        description: `Félicitations à **${winner?.discord_username || 'un membre'}** !\n\n${ranking}`,
        image: winner ? { url: winner.image_url } : undefined,
        color: 0xffd700,
      }],
    }),
  })

  if (winner?.message_id) {
    await discordFetch(`/channels/${contestChannelId()}/messages/${winner.message_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ components: entryVoteButton(week.id, winner.id, true) }),
    }).catch(() => {})
  }
}
