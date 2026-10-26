import { NextResponse } from 'next/server'
import { getTeamByName } from '@/lib/sportsTeams'
import { dayLabel, timeLabel, isoDateInParis, nextDays } from '@/lib/pronosDays'

// ─────────────────────────────────────────────────────────────
// MAQUETTE LOCALE -- route de test pour le module Pronos de l'accueil.
// NBA/NFL/NHL via l'API publique ESPN (site.api.espn.com, aucune clé) --
// api-sports.io a été abandonné pour ces 3 sports : son plan gratuit ne
// donne accès qu'à une fenêtre fixe de 3 jours ("Free plans do not have
// access to this date"), ce qui rendait la quasi-totalité des 7 jours
// vide. ESPN n'a pas cette restriction et donne aussi le vrai bilan W-L
// dans la même réponse. MLB via l'API publique statsapi.mlb.com (aucune
// clé). Champions League via bigballsdata.com (plan gratuit, 1 sport
// inclus, 250 req/jour). Pas encore en prod, page non liée dans git.
// ─────────────────────────────────────────────────────────────

// Beaucoup d'appels externes en parallèle (7 jours x plusieurs sports) --
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
  leftRecord?: string
  rightRecord?: string
}

const BIGBALLS_KEY = process.env.BIGBALLS_API_KEY!

function buildMatch(
  sport: Sport, apiId: string | number, start: Date,
  homeName: string, awayName: string,
  finished: boolean, homeScore: number | null, awayScore: number | null,
  records?: Map<string, string>,
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
    leftRecord: records?.get(away.id),
    rightRecord: records?.get(home.id),
  }
}

// Date calendaire US à interroger -- on prend aussi la veille, pour ne pas
// rater un match qui tombe tard heure US / tôt heure Paris le lendemain.
function usDatesToQuery(parisDate: string): string[] {
  const d = new Date(parisDate + 'T12:00:00Z')
  const prev = new Date(d.getTime() - 86400000)
  return [prev.toISOString().slice(0, 10), parisDate]
}

// ESPN (public, sans clé, aucune restriction de date) -- une seule requête
// donne à la fois les matchs du jour ET le bilan W-L de chaque équipe.
async function fetchEspn(sport: Sport, espnPath: string, parisDate: string, revalidate: number): Promise<OutMatch[]> {
  const out: OutMatch[] = []
  for (const usDate of usDatesToQuery(parisDate)) {
    try {
      const ymd = usDate.replace(/-/g, '')
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard?dates=${ymd}`, { next: { revalidate } })
      if (!res.ok) continue
      const data = await res.json()
      for (const ev of data.events ?? []) {
        const comp = ev.competitions?.[0]
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
        if (!comp || !home || !away) continue

        const start = new Date(comp.date)
        if (isoDateInParis(start) !== parisDate) continue

        const finished = !!comp.status?.type?.completed
        const homeScore = finished ? Number(home.score) : null
        const awayScore = finished ? Number(away.score) : null

        const records = new Map<string, string>()
        const homeTeam = getTeamByName(home.team?.displayName)
        const awayTeam = getTeamByName(away.team?.displayName)
        const homeRec = home.records?.find((r: any) => r.type === 'total')?.summary ?? home.records?.[0]?.summary
        const awayRec = away.records?.find((r: any) => r.type === 'total')?.summary ?? away.records?.[0]?.summary
        if (homeTeam && homeRec) records.set(homeTeam.id, homeRec)
        if (awayTeam && awayRec) records.set(awayTeam.id, awayRec)

        const m = buildMatch(sport, ev.id, start, home.team?.displayName, away.team?.displayName,
          finished, homeScore, awayScore, records)
        if (m) out.push(m)
      }
    } catch { /* ESPN indisponible pour cette date -- on continue avec les autres */ }
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
      const home = getTeamByName(g.teams.home.team.name)
      const away = getTeamByName(g.teams.away.team.name)
      const records = new Map<string, string>()
      if (home && g.teams.home.leagueRecord) records.set(home.id, `${g.teams.home.leagueRecord.wins}-${g.teams.home.leagueRecord.losses}`)
      if (away && g.teams.away.leagueRecord) records.set(away.id, `${g.teams.away.leagueRecord.wins}-${g.teams.away.leagueRecord.losses}`)
      const m = buildMatch('mlb', g.gamePk, start, g.teams.home.team.name, g.teams.away.team.name,
        finished, finished ? g.teams.home.score ?? null : null, finished ? g.teams.away.score ?? null : null, records)
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
  // latence totale est la SOMME de chaque appel au lieu du plus lent.
  const perDay = days.map(({ parisDate }, i) => {
    // Aujourd'hui : rafraîchi toutes les 30 min (résoudre les matchs finis).
    // Jours suivants : toutes les 6h (le calendrier bouge peu à l'avance).
    const revalidate = i === 0 ? 1800 : 21600
    return Promise.all([
      fetchEspn('nba', 'basketball/nba', parisDate, revalidate),
      fetchEspn('nfl', 'football/nfl', parisDate, revalidate),
      fetchEspn('nhl', 'hockey/nhl', parisDate, revalidate),
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
