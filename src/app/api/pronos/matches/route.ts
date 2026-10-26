import { NextResponse } from 'next/server'
import { getTeamByName } from '@/lib/sportsTeams'
import { dayLabel, timeLabel, isoDateInParis, nextDays } from '@/lib/pronosDays'

// ─────────────────────────────────────────────────────────────
// MAQUETTE LOCALE -- route de test pour le module Pronos de l'accueil.
// Agrège NBA/NFL/NHL via api-sports.io (plan gratuit -- la saison en
// cours n'y est pas accessible pour MLB/Football). MLB via l'API
// publique statsapi.mlb.com (aucune clé). Champions League via
// bigballsdata.com (plan gratuit, 250 req/jour, 1 seul sport inclus).
// Pas encore appelée en prod, page non liée dans git.
// ─────────────────────────────────────────────────────────────

// Beaucoup d'appels externes séquentiels (7 jours x plusieurs sports) --
// le timeout par défaut de Vercel (10s) peut couper la réponse en plein
// milieu sur un cold start, ce qui laisse alors une poignée de matchs mis
// en cache côté Next.js et rien pour le reste jusqu'au prochain revalidate.
export const maxDuration = 60

export type Sport = 'nba' | 'nfl' | 'nhl' | 'mlb' | 'football'

interface OutMatch {
  id: string
  sport: Sport
  day: string
  leftId: string
  rightId: string
  time: string
  status: 'upcoming' | 'final'
  locked: boolean
  leftScore?: number
  rightScore?: number
  winner?: 'left' | 'right'
}

const KEY = process.env.API_SPORTS_KEY!
const BIGBALLS_KEY = process.env.BIGBALLS_API_KEY!

async function callApi(url: string, revalidate: number) {
  const res = await fetch(url, {
    headers: { 'x-apisports-key': KEY },
    next: { revalidate },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length) return []
  return data.response ?? []
}

function buildMatch(
  sport: Sport, apiId: string | number, start: Date,
  homeName: string, awayName: string,
  finished: boolean, homeScore: number | null, awayScore: number | null,
): OutMatch | null {
  const home = getTeamByName(homeName)
  const away = getTeamByName(awayName)
  if (!home || !away) return null // équipe non reconnue dans sportsTeams.ts -- on saute plutôt que d'afficher un trou

  const started = Date.now() >= start.getTime()
  const winner = finished && homeScore !== null && awayScore !== null
    ? (homeScore > awayScore ? 'right' : 'left')
    : undefined

  return {
    id: `${sport}-${apiId}`,
    sport,
    day: dayLabel(start),
    leftId: away.id,
    rightId: home.id,
    time: timeLabel(start),
    status: finished ? 'final' : 'upcoming',
    locked: finished || started,
    leftScore: finished ? awayScore ?? undefined : undefined,
    rightScore: finished ? homeScore ?? undefined : undefined,
    winner,
  }
}

// api-sports date par date US -- on interroge la date calendaire Paris ET
// la veille US pour ne rater aucun match qui tombe tard heure US / tôt
// heure Paris le lendemain.
function usDatesToQuery(parisDate: string): string[] {
  const d = new Date(parisDate + 'T12:00:00Z')
  const prev = new Date(d.getTime() - 86400000)
  return [prev.toISOString().slice(0, 10), parisDate]
}

async function fetchNBA(parisDate: string, revalidate: number): Promise<OutMatch[]> {
  const out: OutMatch[] = []
  for (const usDate of usDatesToQuery(parisDate)) {
    const games = await callApi(`https://v2.nba.api-sports.io/games?date=${usDate}`, revalidate)
    for (const g of games) {
      const start = new Date(g.date.start)
      if (isoDateInParis(start) !== parisDate) continue
      const finished = g.status.long === 'Finished'
      const m = buildMatch('nba', g.id, start, g.teams.home.name, g.teams.visitors.name,
        finished, g.scores?.home?.points ?? null, g.scores?.visitors?.points ?? null)
      if (m) out.push(m)
    }
  }
  return out
}

async function fetchNFL(parisDate: string, revalidate: number): Promise<OutMatch[]> {
  const out: OutMatch[] = []
  for (const usDate of usDatesToQuery(parisDate)) {
    const games = await callApi(`https://v1.american-football.api-sports.io/games?date=${usDate}`, revalidate)
    for (const g of games) {
      const start = new Date(g.game.date.timestamp * 1000)
      if (isoDateInParis(start) !== parisDate) continue
      const finished = g.game.status.short === 'FT'
      const m = buildMatch('nfl', g.game.id, start, g.teams.home.name, g.teams.away.name,
        finished, g.scores?.home?.total ?? null, g.scores?.away?.total ?? null)
      if (m) out.push(m)
    }
  }
  return out
}

async function fetchNHL(parisDate: string, revalidate: number): Promise<OutMatch[]> {
  const out: OutMatch[] = []
  for (const usDate of usDatesToQuery(parisDate)) {
    const games = await callApi(`https://v1.hockey.api-sports.io/games?date=${usDate}`, revalidate)
    for (const g of games) {
      if (g.league?.id !== 57) continue // ne garder que la ligue NHL (id 57), pas les autres ligues hockey renvoyées par la même date
      const start = new Date(g.date)
      if (isoDateInParis(start) !== parisDate) continue
      const finished = g.status.short === 'FT'
      const m = buildMatch('nhl', g.id, start, g.teams.home.name, g.teams.away.name,
        finished, g.scores?.home ?? null, g.scores?.away ?? null)
      if (m) out.push(m)
    }
  }
  return out
}

// statsapi.mlb.com -- API publique MLB, aucune clé requise.
async function fetchMLB(parisDate: string, revalidate: number): Promise<OutMatch[]> {
  const out: OutMatch[] = []
  for (const usDate of usDatesToQuery(parisDate)) {
    let games: any[] = []
    try {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${usDate}`, { next: { revalidate } })
      if (res.ok) {
        const data = await res.json()
        games = data.dates?.[0]?.games ?? []
      }
    } catch { /* API MLB indisponible -- on ignore ce jour */ }
    for (const g of games) {
      const start = new Date(g.gameDate)
      if (isoDateInParis(start) !== parisDate) continue
      const finished = g.status?.abstractGameState === 'Final'
      const m = buildMatch('mlb', g.gamePk, start, g.teams.home.team.name, g.teams.away.team.name,
        finished, finished ? g.teams.home.score ?? null : null, finished ? g.teams.away.score ?? null : null)
      if (m) out.push(m)
    }
  }
  return out
}

// bigballsdata.com -- Champions League, plan gratuit (1 sport inclus,
// 250 req/jour). Pas de filtre par date fiable côté API -- on récupère les
// prochains matchs programmés une seule fois et on les répartit par jour
// Paris nous-mêmes.
async function fetchUCL(revalidate: number): Promise<OutMatch[]> {
  if (!BIGBALLS_KEY) return []
  const out: OutMatch[] = []
  try {
    const res = await fetch('https://api.bigballsdata.com/v1/matches?sport=football&league=ucl', {
      headers: { Authorization: `Bearer ${BIGBALLS_KEY}` },
      next: { revalidate },
    })
    if (!res.ok) return []
    const data = await res.json()
    for (const g of data.data ?? []) {
      const start = new Date(g.kickoff_utc)
      const finished = g.status === 'finished' || g.status === 'ft'
      const m = buildMatch('football', g.id, start, g.home.name, g.away.name,
        finished, g.score?.value?.home ?? null, g.score?.value?.away ?? null)
      if (m) out.push(m)
    }
  } catch { /* API bigballsdata indisponible -- on ignore */ }
  return out
}

export async function GET() {
  const days = nextDays(7)

  // Tous les jours x sports en parallèle (pas en séquence) -- sinon la
  // latence totale est la SOMME de chaque appel au lieu du plus lent. Si
  // API_SPORTS_KEY manque, NBA/NFL/NHL renvoient juste [] (callApi le gère
  // déjà) : MLB (sans clé) et Champions League continuent de fonctionner.
  const perDay = days.map(({ parisDate }, i) => {
    // Aujourd'hui : rafraîchi toutes les 30 min (résoudre les matchs finis).
    // Jours suivants : toutes les 6h (le calendrier bouge peu à l'avance).
    const revalidate = i === 0 ? 1800 : 21600
    return Promise.all([
      fetchNBA(parisDate, revalidate),
      fetchNFL(parisDate, revalidate),
      fetchNHL(parisDate, revalidate),
      fetchMLB(parisDate, revalidate),
    ])
  })

  // Un seul appel pour toute la fenêtre (pas de filtre date fiable côté API).
  const [perDayResults, ucl] = await Promise.all([
    Promise.all(perDay),
    fetchUCL(21600),
  ])

  const all: OutMatch[] = ucl.slice()
  for (const [nba, nfl, nhl, mlb] of perDayResults) all.push(...nba, ...nfl, ...nhl, ...mlb)

  return NextResponse.json({ days: days.map(d => d.label), matches: all })
}
