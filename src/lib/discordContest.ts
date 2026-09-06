import type { SupabaseClient } from '@supabase/supabase-js'

const API = 'https://discord.com/api/v10'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Poster beaucoup de messages d'affilee (une entree = un message, voir
// openEntryVote) declenche vite le rate limit Discord (429) -- retry avec le
// retry_after indique par Discord au lieu de laisser planter tout le tick.
export async function discordFetch(path: string, init?: RequestInit, attempt = 0): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (res.status === 429 && attempt < 5) {
    const body = await res.json().catch(() => ({}))
    const retryAfterMs = Math.ceil((body.retry_after ?? 1) * 1000) + 50
    await sleep(retryAfterMs)
    return discordFetch(path, init, attempt + 1)
  }
  if (!res.ok) throw new Error(`Discord API ${path} -> ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

export function contestChannelId(): string {
  const id = process.env.DISCORD_CONTEST_CHANNEL_ID
  if (!id) throw new Error('DISCORD_CONTEST_CHANNEL_ID manquant')
  return id
}

// Semaine courante (lundi, en heure de Paris) -- sert de cle unique pour
// discord_contest_weeks.week_start, insensible au fuseau du serveur qui execute le code.
export function parisWeekStart(d: Date = new Date()): string {
  const parisDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const [y, m, day] = parisDateStr.split('-').map(Number)
  const local = new Date(Date.UTC(y, m - 1, day))
  const dow = local.getUTCDay() // 0=dimanche .. 6=samedi
  const sinceMonday = (dow + 6) % 7
  local.setUTCDate(local.getUTCDate() - sinceMonday)
  return local.toISOString().slice(0, 10)
}

export function parisNow(d: Date = new Date()): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(d)
  const weekday = parts.find(p => p.type === 'weekday')?.value || ''
  const hourRaw = parts.find(p => p.type === 'hour')?.value || '0'
  const hour = parseInt(hourRaw, 10) % 24
  return { weekday, hour }
}

// Choisit N themes actifs en excluant en priorite ceux utilises recemment
// (fenetre glissante). Si le pool eligible est trop petit, on complete quand
// meme avec les themes les moins recemment utilises plutot que de bloquer.
export async function pickThemes(supabase: SupabaseClient, count: number, excludeWeeksWindow = 8) {
  const { data: themes } = await supabase
    .from('discord_contest_themes')
    .select('id, label, last_used_at')
    .eq('active', true)

  const all = themes || []
  if (all.length <= count) return all

  const cutoff = Date.now() - excludeWeeksWindow * 7 * 24 * 60 * 60 * 1000
  const eligible = all.filter(t => !t.last_used_at || new Date(t.last_used_at).getTime() < cutoff)
  const pool = eligible.length >= count ? eligible : [...all].sort((a, b) => {
    if (!a.last_used_at) return -1
    if (!b.last_used_at) return 1
    return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime()
  })

  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function themeVoteButtons(weekId: string, themes: { id: string; label: string }[]) {
  return [{
    type: 1,
    components: themes.map(t => ({
      type: 2,
      style: 1,
      label: t.label.slice(0, 80),
      custom_id: `cvote:${weekId}:${t.id}`,
    })),
  }]
}

export function entryVoteButton(weekId: string, entryId: string, disabled = false) {
  return [{
    type: 1,
    components: [{
      type: 2,
      style: 3,
      label: '🗳️ Voter pour cette carte',
      custom_id: `evote:${weekId}:${entryId}`,
      disabled,
    }],
  }]
}
