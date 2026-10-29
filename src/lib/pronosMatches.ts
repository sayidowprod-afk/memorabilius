import { getTeamByName } from '@/lib/sportsTeams'
import { sportDayLabel, sportDate, timeLabel, daysForOffsets } from '@/lib/pronosDays'

// Sources (toutes gratuites) : NBA/NFL/NHL via l'API publique ESPN (aucune
// clé, aucune restriction de date -- api-sports.io a été abandonné, son plan
// gratuit se limite à une fenêtre fixe de 3 jours), MLB via statsapi.mlb.com
// (aucune clé), Champions League via bigballsdata.com (plan gratuit).

export type Sport = 'nba' | 'nfl' | 'nhl' | 'mlb' | 'football'

export interface OutMatch {
  id: string
  sport: Sport
  day: string
  kickoff: string // ISO UTC
  leftId: string
  rightId: string
  time: string
  status: 'upcoming' | 'final'
  locked: boolean
  leftScore?: number
  rightScore?: number
  // Issue du match : un camp, ou « draw » (nul). NHL : nul = egalite a la fin du temps
  // reglementaire (match decide en prolongation ou aux tirs au but).
  winner?: 'left' | 'right' | 'draw'
  // Le « match nul » est proposable au pronostic (football, NHL).
  drawable: boolean
  // « Prolongation » / « Tirs au but » (NHL).
  note?: string
  leftRecord?: string
  rightRecord?: string
}

const BIGBALLS_KEY = process.env.BIGBALLS_API_KEY

function buildMatch(
  sport: Sport, apiId: string | number, start: Date,
  homeName: string, awayName: string,
  finished: boolean, homeScore: number | null, awayScore: number | null,
  records?: Map<string, string>,
  overtime?: string, // NHL : « Prolongation » / « Tirs au but » quand la partie n'est pas finie dans le temps reglementaire
): OutMatch | null {
  const home = getTeamByName(homeName)
  const away = getTeamByName(awayName)
  if (!home || !away) return null // équipe non reconnue dans sportsTeams.ts -- on saute plutôt que d'afficher un trou

  const started = Date.now() >= start.getTime()
  const drawable = sport === 'football' || sport === 'nhl'
  let winner: OutMatch['winner']
  if (finished && homeScore !== null && awayScore !== null) {
    if (overtime || homeScore === awayScore) winner = 'draw'
    else winner = homeScore > awayScore ? 'right' : 'left'
  }

  return {
    id: `${sport}-${apiId}`,
    sport,
    day: sportDayLabel(start),
    kickoff: start.toISOString(),
    leftId: away.id,
    rightId: home.id,
    time: timeLabel(start),
    status: finished ? 'final' : 'upcoming',
    locked: finished || started,
    leftScore: finished ? awayScore ?? undefined : undefined,
    rightScore: finished ? homeScore ?? undefined : undefined,
    winner,
    drawable,
    note: finished ? overtime : undefined,
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
        if (sportDate(start) !== parisDate) continue

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

        // NHL : periode > 3 = prolongation (4) ou tirs au but (5). Le detail « Final/OT » / « Final/SO » le confirme.
        const detail = String(comp.status?.type?.shortDetail ?? '')
        const period = Number(comp.status?.period)
        let overtime: string | undefined
        if (sport === 'nhl' && finished) {
          if (/\/SO\b/i.test(detail) || period >= 5) overtime = 'Tirs au but'
          else if (/\/\d*OT\b/i.test(detail) || period === 4) overtime = 'Prolongation'
        }
        const m = buildMatch(sport, ev.id, start, home.team?.displayName, away.team?.displayName,
          finished, homeScore, awayScore, records, overtime)
        if (m) out.push(m)
      }
    } catch { /* ESPN indisponible pour cette date -- on continue avec les autres */ }
  }
  return out
}

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
      if (sportDate(start) !== parisDate) continue
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

// Pas de filtre par date fiable côté API -- on récupère les prochains
// matchs programmés une seule fois ; la répartition par jour se fait plus
// tard (champ `day`).
async function fetchUCL(revalidate: number): Promise<OutMatch[]> {
  if (!BIGBALLS_KEY) return []
  const out: OutMatch[] = []
  const seen = new Set<string>()
  // Sans filtre l'API ne renvoie que les matchs à venir ; les terminés
  // (nécessaires pour résoudre les picks) demandent status=finished.
  for (const qs of ['', '&status=finished']) {
    try {
      const res = await fetch(`https://api.bigballsdata.com/v1/matches?sport=football&league=ucl${qs}`, {
        headers: { Authorization: `Bearer ${BIGBALLS_KEY}` },
        next: { revalidate },
      })
      if (!res.ok) continue
      const data = await res.json()
      for (const g of data.data ?? []) {
        if (seen.has(g.id)) continue
        seen.add(g.id)
        const start = new Date(g.kickoff_utc)
        const finished = g.status === 'finished' || g.status === 'ft'
        const m = buildMatch('football', g.id, start, g.home.name, g.away.name,
          finished, g.score?.home ?? null, g.score?.away ?? null)
        if (m) out.push(m)
      }
    } catch { /* API bigballsdata indisponible -- on ignore */ }
  }
  return out
}

// offsets : décalages en jours par rapport à aujourd'hui (Paris). Négatif =
// jours passés (utile pour résoudre les picks après coup).
export async function fetchMatchesForOffsets(offsets: number[], opts?: { includeUCL?: boolean }) {
  const days = daysForOffsets(offsets)

  const perDay = days.map(({ parisDate, offset }) => {
    // Aujourd'hui/hier : rafraîchi souvent (un match peut venir de finir).
    // Plus ancien ou futur : le calendrier / les résultats bougent peu.
    const revalidate = offset === 0 || offset === -1 ? 1800 : offset < 0 ? 43200 : 21600
    return Promise.all([
      fetchEspn('nba', 'basketball/nba', parisDate, revalidate),
      fetchEspn('nfl', 'football/nfl', parisDate, revalidate),
      fetchEspn('nhl', 'hockey/nhl', parisDate, revalidate),
      fetchMLB(parisDate, revalidate),
    ])
  })

  const [perDayResults, ucl] = await Promise.all([
    Promise.all(perDay),
    opts?.includeUCL === false ? Promise.resolve([] as OutMatch[]) : fetchUCL(21600),
  ])

  // L'API UCL renvoie tout (passé + futur) sans filtre de date : on ne garde
  // que la fenêtre demandée, sinon un vieux match au même "MAR 27" qu'un
  // jour de la fenêtre (autre mois, même jour de semaine + numéro) apparaîtrait.
  const windowDates = new Set(days.map(d => d.parisDate))
  const matches: OutMatch[] = ucl.filter(m => windowDates.has(sportDate(new Date(m.kickoff))))
  for (const [nba, nfl, nhl, mlb] of perDayResults) matches.push(...nba, ...nfl, ...nhl, ...mlb)
  return { days: days.map(d => d.label), matches }
}
