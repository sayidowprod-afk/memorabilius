// Box scores du module Pronos : stats individuelles par joueur, normalisées
// dans un même format quel que soit le sport (ESPN pour NBA/NFL/NHL,
// statsapi.mlb.com pour MLB). `side` suit le modèle des matchs :
// left = équipe à l'extérieur, right = équipe à domicile.

export interface BoxRow { name: string; pos?: string; stats: string[]; note?: string; headshot?: string }
export interface BoxGroup { title: string; labels: string[]; rows: BoxRow[]; totals?: string[] }
export interface BoxTeam { side: 'left' | 'right'; name: string; abbr?: string; groups: BoxGroup[] }
export interface BoxScore { teams: BoxTeam[] }

const ESPN_PATHS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl' }

// Colonnes retenues par sport/groupe (ESPN en renvoie beaucoup, dont des
// cumuls de saison illisibles sur un téléphone). Absent = tout garder.
const KEEP: Record<string, Record<string, string[]>> = {
  nba: { '': ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT', '+/-'] },
  nhl: {
    forwards: ['TOI', 'G', 'A', '+/-', 'SOG', 'HT', 'BS', 'PIM'],
    defenses: ['TOI', 'G', 'A', '+/-', 'SOG', 'HT', 'BS', 'PIM'],
    goalies: ['SA', 'GA', 'SV', 'SV%', 'TOI'],
  },
  nfl: {
    passing: ['C/ATT', 'YDS', 'TD', 'INT', 'RTG'],
    rushing: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'],
    receiving: ['REC', 'YDS', 'TD', 'LONG', 'TGTS'],
    defensive: ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD'],
    kicking: ['FG', 'PCT', 'LONG', 'XP', 'PTS'],
  },
}

const GROUP_TITLES: Record<string, string> = {
  passing: 'Passes', rushing: 'Courses', receiving: 'Réceptions', defensive: 'Défense', kicking: 'Bottés',
  forwards: 'Attaquants', defenses: 'Défenseurs', goalies: 'Gardiens',
}

async function getJson(url: string, revalidate: number) {
  const res = await fetch(url, { next: { revalidate } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function espnBoxscore(sport: string, eventId: string): Promise<BoxScore> {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATHS[sport]}/summary?event=${eventId}`, 600)
  const comps: any[] = data.header?.competitions?.[0]?.competitors ?? []
  const sideById = new Map<string, 'left' | 'right'>(comps.map((c: any) => [String(c.id), c.homeAway === 'home' ? 'right' : 'left']))

  const teams: BoxTeam[] = []
  for (const p of data.boxscore?.players ?? []) {
    const side = sideById.get(String(p.team?.id))
    if (!side) continue
    const stats: any[] = p.statistics ?? []
    // NHL : le groupe agrégé "skaters" double forwards + defenses.
    const skip = sport === 'nhl' && stats.some(g => g.name === 'forwards') ? new Set(['skaters']) : new Set<string>()

    const groups: BoxGroup[] = []
    for (const g of stats) {
      if (skip.has(g.name)) continue
      const keepList = KEEP[sport]?.[sport === 'nba' ? '' : g.name]
      if (KEEP[sport] && sport !== 'nba' && !keepList) continue // groupe sans intérêt (retours, fumbles...)
      const labels: string[] = g.labels ?? []
      const idx = keepList ? keepList.map(l => labels.indexOf(l)).filter(i => i >= 0) : labels.map((_, i) => i).slice(0, 12)
      if (idx.length === 0) continue

      const starters: BoxRow[] = [], bench: BoxRow[] = []
      for (const a of g.athletes ?? []) {
        if (!a.stats || a.stats.length === 0 || a.didNotPlay) continue
        const row: BoxRow = {
          name: a.athlete?.shortName || a.athlete?.displayName || '?',
          pos: a.athlete?.position?.abbreviation,
          headshot: a.athlete?.headshot?.href,
          stats: idx.map(i => String(a.stats[i] ?? '')),
        }
        ;(a.starter ? starters : bench).push(row)
      }
      const outLabels = idx.map(i => labels[i])
      const totals = sport === 'nba' && g.totals ? idx.map(i => String(g.totals[i] ?? '')) : undefined
      if (sport === 'nba') {
        // Comme sur les apps de scores : titulaires puis banc.
        if (starters.length) groups.push({ title: 'Titulaires', labels: outLabels, rows: starters })
        if (bench.length) groups.push({ title: 'Banc', labels: outLabels, rows: bench })
        if (groups.length) groups[groups.length - 1].totals = totals
      } else {
        const rows = [...starters, ...bench]
        if (rows.length) groups.push({ title: (stats.length > 1 && GROUP_TITLES[g.name]) || '', labels: outLabels, rows })
      }
    }
    teams.push({ side, name: p.team?.displayName ?? '', abbr: p.team?.abbreviation, groups })
  }
  teams.sort((a, b) => (a.side === 'left' ? -1 : 1) - (b.side === 'left' ? -1 : 1))
  return { teams }
}

const mlbHeadshot = (id?: number) =>
  id ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_80,q_auto:best/v1/people/${id}/headshot/67/current` : undefined

async function mlbBoxscore(gamePk: string): Promise<BoxScore> {
  const data = await getJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`, 600)
  const teams: BoxTeam[] = []
  for (const [key, side] of [['away', 'left'], ['home', 'right']] as const) {
    const t = data.teams?.[key]
    if (!t) continue
    const players = t.players ?? {}
    const batters: BoxRow[] = (t.battingOrder ?? []).map((id: number) => players['ID' + id]).filter(Boolean).map((pl: any) => {
      const b = pl.stats?.batting ?? {}
      return { name: pl.person?.fullName ?? '?', pos: pl.position?.abbreviation, headshot: mlbHeadshot(pl.person?.id), stats: [b.atBats, b.runs, b.hits, b.homeRuns, b.rbi, b.baseOnBalls, b.strikeOuts].map(v => String(v ?? 0)) }
    })
    const pitchers: BoxRow[] = (t.pitchers ?? []).map((id: number) => players['ID' + id]).filter(Boolean).map((pl: any) => {
      const p = pl.stats?.pitching ?? {}
      return { name: pl.person?.fullName ?? '?', note: p.note, headshot: mlbHeadshot(pl.person?.id), stats: [p.inningsPitched, p.hits, p.runs, p.earnedRuns, p.baseOnBalls, p.strikeOuts].map(v => String(v ?? 0)) }
    })
    const groups: BoxGroup[] = []
    if (batters.length) groups.push({ title: 'Frappeurs', labels: ['AB', 'R', 'H', 'HR', 'RBI', 'BB', 'K'], rows: batters })
    if (pitchers.length) groups.push({ title: 'Lanceurs', labels: ['IP', 'H', 'R', 'ER', 'BB', 'K'], rows: pitchers })
    teams.push({ side, name: t.team?.name ?? '', abbr: t.team?.abbreviation, groups })
  }
  return { teams }
}

// id = identifiant de match renvoyé par /api/pronos/matches ("nba-401909868").
export async function getBoxScore(matchId: string): Promise<BoxScore | null> {
  const dash = matchId.indexOf('-')
  if (dash < 0) return null
  const sport = matchId.slice(0, dash), apiId = matchId.slice(dash + 1)
  if (!/^[A-Za-z0-9-]{1,64}$/.test(apiId)) return null
  if (sport === 'nba' || sport === 'nfl' || sport === 'nhl') return espnBoxscore(sport, apiId)
  if (sport === 'mlb') return mlbBoxscore(apiId)
  return null // football (Champions League) : pas de source de box score gratuite branchée
}
