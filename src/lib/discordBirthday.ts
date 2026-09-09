import type { SupabaseClient } from '@supabase/supabase-js'
import { discordFetch } from '@/lib/discordContest'

export function birthdayChannelId(): string {
  const id = process.env.DISCORD_BIRTHDAY_CHANNEL_ID
  if (!id) throw new Error('DISCORD_BIRTHDAY_CHANNEL_ID manquant')
  return id
}

// Jour calendaire cote Paris -- coherent avec parisWeekStart/parisNow du
// concours, insensible au fuseau du serveur qui execute le cron.
export function parisToday(d: Date = new Date()): { dateStr: string; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const [y, m, day] = parts.split('-').map(Number)
  return { dateStr: parts, month: m, day }
}

export interface BirthdayPlayer {
  id: string
  player_name: string
  birth_date: string
  headshot_url: string | null
  sport: string
}

// Emoji par sport pour le message public -- avant le multi-sport, "🏀" etait
// hardcode ici (n'avait pas d'importance tant que seule la NBA existait).
const SPORT_EMOJI: Record<string, string> = {
  nba: '🏀', nfl: '🏈', baseball: '⚾', hockey: '🏒', football: '⚽',
}

function age(player: BirthdayPlayer, dateStr: string): number | null {
  const birthYear = parseInt(player.birth_date.slice(0, 4))
  const thisYear = parseInt(dateStr.slice(0, 4))
  if (!birthYear || !thisYear) return null
  return thisYear - birthYear
}

export function birthdayEmbed(player: BirthdayPlayer, dateStr: string) {
  const a = age(player, dateStr)
  const emoji = SPORT_EMOJI[player.sport] || '🎉'
  return {
    content: `🎂 Aujourd'hui c'est l'anniversaire de **${player.player_name}**${a ? ` (${a} ans)` : ''} ! Alors postons une carte pour lui souhaiter un bon anniversaire ${emoji}`,
    embeds: player.headshot_url ? [{ image: { url: player.headshot_url }, color: 0xf39c12 }] : [],
  }
}

// Poste l'annonce publique et memorise l'etat -- appele soit directement par
// le cron (1 seul candidat ce jour-la), soit par le clic admin (plusieurs
// candidats, voir handleBirthdayComponent dans api/discord/route.ts).
export async function postPublicBirthday(supabase: SupabaseClient, player: BirthdayPlayer, dateStr: string) {
  const msg = await discordFetch(`/channels/${birthdayChannelId()}/messages`, {
    method: 'POST',
    body: JSON.stringify(birthdayEmbed(player, dateStr)),
  })
  await supabase.from('nba_birthday_posts').update({
    status: 'posted', chosen_player_id: player.id, message_id: msg.id,
  }).eq('post_date', dateStr)
  return msg
}

// Discord limite a 5 boutons par action row et 5 rows par message (25 max) --
// largement suffisant. Avec 5 sports desormais confondus dans le meme pool
// quotidien, prefixer le sport sur chaque bouton evite toute ambiguite pour
// l'admin qui choisit (ex: deux "Chris Paul" plausibles si jamais).
export function birthdayPickButtons(dateStr: string, candidates: BirthdayPlayer[]) {
  const buttons = candidates.slice(0, 25).map(p => ({
    type: 2, style: 1, label: `${SPORT_EMOJI[p.sport] || ''} ${p.player_name}`.trim().slice(0, 80), custom_id: `bday:${dateStr}:${p.id}`,
  }))
  const rows = []
  for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) })
  return rows
}
