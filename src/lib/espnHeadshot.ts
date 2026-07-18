// ── NBA CDN (tous les joueurs, actifs + retraités) ────────────────────────────
// stats.nba.com peut être bloqué en dev local mais fonctionne sur Vercel

let nbaMapCache: Map<string, number> | null = null
let nbaMapExpiry = 0

async function getNbaPlayerMap(): Promise<Map<string, number>> {
  if (nbaMapCache && Date.now() < nbaMapExpiry) return nbaMapCache
  try {
    const r = await fetch(
      'https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.nba.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'x-nba-stats-origin': 'stats',
          'x-nba-stats-token': 'true',
        },
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 86400 },
      } as RequestInit
    )
    if (!r.ok) return nbaMapCache ?? new Map()
    const data = await r.json()
    const rows: any[][] = data?.resultSets?.[0]?.rowSet ?? []
    const map = new Map<string, number>()
    for (const row of rows) {
      const id: number = row[0]
      const name: string = row[2] // DISPLAY_FIRST_LAST e.g. "Michael Jordan"
      if (id && name) map.set(name.toLowerCase(), id)
    }
    nbaMapCache = map
    nbaMapExpiry = Date.now() + 86400_000
    return map
  } catch {
    return nbaMapCache ?? new Map()
  }
}

async function fetchNbaHeadshot(name: string): Promise<string | null> {
  const map = await getNbaPlayerMap()
  if (map.size === 0) return null
  // Match exact uniquement — le fuzzy substring matchait parfois le mauvais joueur
  // (ex: Anthony Edwards → photo d'un joueur historique au nom proche)
  const id = map.get(name.toLowerCase())
  if (!id) return null
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}

// ── ESPN search/v2 (fallback pour sports non-NBA et joueurs non matchés) ──────
const SPORT_MAP: Record<string, string> = {
  nba: 'basketball', nfl: 'football', nhl: 'hockey', mlb: 'baseball', football: 'soccer',
  hockey: 'hockey', baseball: 'baseball',
}

// Ligue ESPN attendue par sport interne
const LEAGUE_MAP: Record<string, string> = {
  nba: 'nba', nfl: 'nfl', nhl: 'nhl', mlb: 'mlb',
  hockey: 'nhl', baseball: 'mlb',
}

// ESPN defaultLeagueSlug → notre nom de sport interne
const ESPN_LEAGUE_TO_SPORT: Record<string, string> = {
  nba: 'nba', wnba: 'nba', fiba: 'nba',
  nfl: 'nfl',
  nhl: 'hockey',
  mlb: 'baseball',
  mls: 'football', 'premier-league': 'football', 'serie-a': 'football',
  'ligue-1': 'football', bundesliga: 'football', laliga: 'football',
}

// Normalise pour comparaison insensible aux accents, ponctuation et casse
// "O.G. Anunoby" → "og anunoby" | "Nikola Jokić" → "nikola jokic"
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchEspnMap(query: string, sport = 'nba'): Promise<Map<string, string>> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const expectedLeague = LEAGUE_MAP[sport]
  // Map double : clé exacte lowercase ET clé normalisée → même URL
  const result = new Map<string, string>()
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return result
    const data = await r.json()
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        // Écarte les homonymes d'une autre ligue (ex: "Michael Jordan" NFL/NCAA
        // renvoyé par ESPN à côté du vrai joueur NBA du même nom)
        if (expectedLeague && a.defaultLeagueSlug && a.defaultLeagueSlug !== expectedLeague) continue
        const photo: string | undefined = a.image?.default
        if (a.displayName && photo) {
          const name = a.displayName as string
          result.set(name.toLowerCase(), photo)
          result.set(norm(name), photo) // clé normalisée en plus
        }
      }
    }
  } catch { /* ESPN unavailable */ }
  return result
}

// ── NBA Stats : IDs équipe pour récupérer les rosters historiques ─────────────
const NBA_TEAM_IDS: Record<string, number> = {
  'Atlanta Hawks': 1610612737,
  'Boston Celtics': 1610612738,
  'Brooklyn Nets': 1610612751,
  'Charlotte Hornets': 1610612766,
  'Chicago Bulls': 1610612741,
  'Cleveland Cavaliers': 1610612739,
  'Dallas Mavericks': 1610612742,
  'Denver Nuggets': 1610612743,
  'Detroit Pistons': 1610612765,
  'Golden State Warriors': 1610612744,
  'Houston Rockets': 1610612745,
  'Indiana Pacers': 1610612754,
  'Los Angeles Clippers': 1610612746,
  'Los Angeles Lakers': 1610612747,
  'Memphis Grizzlies': 1610612763,
  'Miami Heat': 1610612748,
  'Milwaukee Bucks': 1610612749,
  'Minnesota Timberwolves': 1610612750,
  'New Orleans Pelicans': 1610612740,
  'New York Knicks': 1610612752,
  'Oklahoma City Thunder': 1610612760,
  'Orlando Magic': 1610612753,
  'Philadelphia 76ers': 1610612755,
  'Phoenix Suns': 1610612756,
  'Portland Trail Blazers': 1610612757,
  'Sacramento Kings': 1610612758,
  'San Antonio Spurs': 1610612759,
  'Toronto Raptors': 1610612761,
  'Utah Jazz': 1610612762,
  'Washington Wizards': 1610612764,
  // Franchises historiques
  'New Jersey Nets': 1610612751,
  'Seattle SuperSonics': 1610612760,
  'Vancouver Grizzlies': 1610612763,
  'New Orleans Hornets': 1610612740,
  'New Orleans/Oklahoma City Hornets': 1610612740,
  'Charlotte Bobcats': 1610612766,
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.nba.com/',
  'Accept': 'application/json, text/plain, */*',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
}

function buildStints(career: { year: number; teamName: string }[]) {
  const sorted = [...career].filter(e => e.year > 0).sort((a, b) => a.year - b.year)
  const runs: { teamName: string; startYear: number; endYear: number }[] = []
  for (const { year, teamName } of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.teamName === teamName && year <= last.endYear + 1) last.endYear = year
    else runs.push({ teamName, startYear: year, endYear: year })
  }
  return runs
}

async function fetchRosterJersey(playerName: string, teamId: number, season: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://stats.nba.com/stats/commonteamroster?TeamID=${teamId}&Season=${season}`,
      { headers: NBA_HEADERS, signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } } as RequestInit
    )
    if (!r.ok) return null
    const data = await r.json()
    const headers: string[] = data?.resultSets?.[0]?.headers ?? []
    const rows: any[][] = data?.resultSets?.[0]?.rowSet ?? []
    const playerIdx = headers.indexOf('PLAYER')
    const jerseyIdx = headers.indexOf('NUM')
    if (playerIdx < 0 || jerseyIdx < 0) return null
    const nameParts = playerName.toLowerCase().split(' ')
    for (const row of rows) {
      const rn = (row[playerIdx] as string || '').toLowerCase()
      if (nameParts.every(p => rn.includes(p))) return String(row[jerseyIdx] ?? '').trim() || null
    }
    return null
  } catch { return null }
}

async function fetchNbaPlayerAwards(playerName: string): Promise<string[]> {
  const map = await getNbaPlayerMap()
  const id = map.get(playerName.toLowerCase())
  if (!id) return []
  try {
    const r = await fetch(
      `https://stats.nba.com/stats/playerawards?PlayerID=${id}`,
      { headers: NBA_HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } } as RequestInit
    )
    if (!r.ok) return []
    const data = await r.json()
    const hdrs: string[] = data?.resultSets?.[0]?.headers ?? []
    const rows: any[][] = data?.resultSets?.[0]?.rowSet ?? []
    const descIdx = hdrs.indexOf('DESCRIPTION')
    if (descIdx < 0) return []
    const counts = new Map<string, number>()
    for (const row of rows) {
      const desc = String(row[descIdx] || '').trim()
      if (desc) counts.set(desc, (counts.get(desc) || 0) + 1)
    }
    const priority: Record<string, number> = {
      'NBA Champion': 10, 'NBA Finals Most Valuable Player': 9, 'Most Valuable Player': 8,
      'Scoring Title': 7, 'Defensive Player of the Year': 6, 'Rookie of the Year': 5,
      'All-Star': 4, 'All-NBA First Team': 4, 'All-NBA Second Team': 3, 'All-NBA Third Team': 2,
      'All-Defensive First Team': 3, 'All-Defensive Second Team': 2,
      'Sixth Man of the Year': 2, 'Most Improved Player': 2,
    }
    return [...counts.entries()]
      .sort((a, b) => (priority[b[0]] ?? 1) - (priority[a[0]] ?? 1))
      .map(([desc, count]) => count > 1 ? `${desc} ×${count}` : desc)
  } catch { return [] }
}

// ── API publique ───────────────────────────────────────────────────────────────

export async function fetchEspnHeadshots(
  query: string,
  sport = 'nba'
): Promise<Map<string, string>> {
  if (sport === 'nba') {
    // ESPN d'abord — headshots corrects pour les joueurs actuels
    const espnMap = await fetchEspnMap(query, sport)
    if (espnMap.size > 0) return espnMap

    // Fallback NBA CDN pour les joueurs retraités absents d'ESPN
    const map = await getNbaPlayerMap()
    const result = new Map<string, string>()
    const q = query.toLowerCase()
    for (const [name, id] of map) {
      if (name.includes(q)) {
        result.set(name, `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`)
      }
    }
    return result
  }
  return fetchEspnMap(query, sport)
}

// ── Wikipedia (dernier recours pour les très vieux joueurs absents ────────────
// des bases ESPN/NBA modernes — ex: George Mikan, Dolph Schayes, Bill Russell)
const WIKI_SPORT_KEYWORDS: Record<string, string[]> = {
  nba: ['basketball'],
  nfl: ['american football', 'gridiron football'],
  nhl: ['ice hockey'],
  mlb: ['baseball'],
}

async function fetchWikipediaHeadshot(name: string, sport: string): Promise<string | null> {
  try {
    const title = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 86400 },
      headers: { 'User-Agent': 'Memorabilius/1.0 (card collection app)' },
    } as RequestInit)
    if (!r.ok) return null
    const data = await r.json()
    if (data.type === 'disambiguation') return null
    // Vérifie que la description Wikipedia correspond bien au sport attendu,
    // pour éviter d'afficher la photo d'un homonyme non-sportif
    const keywords = WIKI_SPORT_KEYWORDS[sport]
    const desc = (data.description || data.extract || '').toLowerCase()
    if (keywords && !keywords.some(k => desc.includes(k))) return null
    return data.thumbnail?.source || data.originalimage?.source || null
  } catch {
    return null
  }
}

export async function fetchEspnHeadshot(name: string, sport = 'nba'): Promise<string | null> {
  // ESPN d'abord (headshots propres pour joueurs actuels)
  const espnMap = await fetchEspnMap(name, sport)
  const espnHit = espnMap.get(name.toLowerCase()) ?? espnMap.get(norm(name)) ?? null
  if (espnHit) return espnHit

  // Fallback NBA CDN pour les retraités (Jordan, Kobe…)
  if (sport === 'nba') {
    const nba = await fetchNbaHeadshot(name)
    if (nba) return nba
  }

  // Dernier recours : Wikipedia, pour les légendes trop anciennes pour
  // avoir une fiche ESPN/NBA avec photo (ère pré-1990)
  const wiki = await fetchWikipediaHeadshot(name, sport)
  if (wiki) return wiki

  return null
}

// ── Bio ESPN (date de naissance, lieu, historique d'équipes) ──────────────────

export interface EspnPlayerBio {
  sport: string | null
  birthDate: string | null
  birthPlace: string | null
  teams: string[]
  position: string | null
  height: string | null
  weight: string | null
  jersey: string | null
  nationality: string | null
  age: number | null
  currentTeamId: string | null
  currentTeamLogo: string | null
  career: { year: number; teamName: string }[]
  honors: string[]
  jerseyHistory: { teamName: string; startYear: number; jersey: string }[]
}

async function findEspnAthleteId(name: string, sportHint?: string): Promise<{ id: string; sport: string } | null> {
  const espnSport = sportHint ? (SPORT_MAP[sportHint] || 'basketball') : undefined
  const expectedLeague = sportHint ? LEAGUE_MAP[sportHint] : undefined
  try {
    const url = espnSport
      ? `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player&sport=${espnSport}`
      : `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return null
    const data = await r.json()
    const target = norm(name)
    let fallback: { id: string; sport: string } | null = null
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        if (!a.displayName || norm(a.displayName) !== target || !a.uid) continue
        const m = /a:(\d+)/.exec(a.uid)
        if (!m) continue
        const espnLeague = (a.defaultLeagueSlug as string) || ''
        const detectedSport = ESPN_LEAGUE_TO_SPORT[espnLeague] ?? sportHint ?? 'nba'
        if (expectedLeague && a.defaultLeagueSlug === expectedLeague) return { id: m[1], sport: detectedSport }
        if (!fallback) fallback = { id: m[1], sport: detectedSport }
      }
    }
    return fallback
  } catch { /* ESPN unavailable */ }
  return null
}

export async function fetchEspnPlayerBio(name: string, sportHint?: string): Promise<EspnPlayerBio | null> {
  const found = await findEspnAthleteId(name, sportHint)
  if (!found) return null
  const { id, sport } = found
  const league = LEAGUE_MAP[sport] || 'nba'
  const espnSport = SPORT_MAP[sport] || 'basketball'

  let birthDate: string | null = null
  let birthPlace: string | null = null
  let position: string | null = null
  let height: string | null = null
  let weight: string | null = null
  let jersey: string | null = null
  let nationality: string | null = null
  let age: number | null = null
  let currentTeamId: string | null = null
  let currentTeamLogo: string | null = null
  let honors: string[] = []
  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/athletes/${id}?lang=en&region=us`,
      { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit
    )
    if (r.ok) {
      const data = await r.json()
      birthDate = data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : null
      const bp = data.birthPlace
      birthPlace = bp ? [bp.city, bp.state || bp.country].filter(Boolean).join(', ') : null
      position = data.position?.displayName || data.position?.abbreviation || null
      height = data.displayHeight || null
      weight = data.displayWeight || null
      jersey = data.jersey || null
      nationality = data.citizenship || null
      age = data.age || null
      // Honors/achievements (présents sur certaines fiches ESPN)
      if (Array.isArray(data.honors)) {
        for (const h of data.honors) {
          if (typeof h === 'string') honors.push(h)
          else if (h?.displayName) honors.push(h.displayName as string)
          else if (h?.name) honors.push(h.name as string)
        }
      } else if (Array.isArray(data.awards)) {
        for (const h of data.awards) {
          if (typeof h === 'string') honors.push(h)
          else if (h?.displayName) honors.push(h.displayName as string)
          else if (h?.name) honors.push(h.name as string)
        }
      }
      // Logo équipe actuelle
      const teamRef: string | undefined = data.team?.$ref
      if (teamRef) {
        const m = /\/teams\/(\d+)/.exec(teamRef)
        if (m) {
          currentTeamId = m[1]
          currentTeamLogo = `https://a.espncdn.com/i/teamlogos/${league}/500/${m[1]}.png`
        }
      }
    }
  } catch { /* ESPN unavailable */ }

  let teams: string[] = []
  let career: { year: number; teamName: string }[] = []
  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/athletes/${id}/statisticslog?lang=en&region=us`,
      { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit
    )
    if (r.ok) {
      const data = await r.json()
      const teamIds = new Set<string>()
      // { teamId → Set<year> }
      const teamYears = new Map<string, Set<number>>()
      for (const entry of data.entries ?? []) {
        // L'année est dans entry.season.$ref (ex: ".../seasons/2026?...") pas dans .year
        const seasonRef: string | undefined = entry.season?.$ref
        const yearMatch = seasonRef ? /\/seasons\/(\d{4})/.exec(seasonRef) : null
        const year: number | undefined =
          entry.year ?? entry.seasonYear ?? entry.season?.year ??
          (yearMatch ? parseInt(yearMatch[1]) : undefined)
        for (const s of entry.statistics ?? []) {
          // Seules les entrées de type "team" ont un $ref d'équipe
          const ref: string | undefined = s?.team?.$ref
          const m = ref ? /\/teams\/(\d+)/.exec(ref) : null
          if (m) {
            teamIds.add(m[1])
            if (year) {
              if (!teamYears.has(m[1])) teamYears.set(m[1], new Set())
              teamYears.get(m[1])!.add(year)
            }
          }
        }
      }
      const teamIdsArr = [...teamIds]
      const names = await Promise.all(teamIdsArr.map(async tid => {
        try {
          const tr = await fetch(
            `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/teams/${tid}?lang=en&region=us`,
            { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } } as RequestInit
          )
          if (!tr.ok) return null
          const td = await tr.json()
          return td.displayName as string | undefined
        } catch { return null }
      }))
      teams = names.filter((n): n is string => !!n)

      // Construire l'historique : une entrée par (année, équipe)
      const careerEntries: { year: number; teamName: string }[] = []
      for (let i = 0; i < teamIdsArr.length; i++) {
        const name = names[i]
        if (!name) continue
        const years = teamYears.get(teamIdsArr[i])
        if (years) {
          for (const y of years) careerEntries.push({ year: y, teamName: name })
        } else {
          careerEntries.push({ year: 0, teamName: name })
        }
      }
      career = careerEntries.sort((a, b) => a.year - b.year)
    }
  } catch { /* ESPN unavailable */ }

  // Numéros de maillot historiques via NBA Stats roster (un appel par stint, en parallèle)
  const jerseyHistory: { teamName: string; startYear: number; jersey: string }[] = []
  if (career.length > 0) {
    const stints = buildStints(career)
    const results = await Promise.all(stints.map(async stint => {
      const teamId = NBA_TEAM_IDS[stint.teamName]
      if (!teamId) return null
      const season = `${stint.startYear}-${String(stint.startYear + 1).slice(2)}`
      const j = await fetchRosterJersey(name, teamId, season)
      return j ? { teamName: stint.teamName, startYear: stint.startYear, jersey: j } : null
    }))
    for (const r of results) { if (r) jerseyHistory.push(r) }
  }

  // Pour NBA : NBA Stats playerawards est plus complet que l'API ESPN
  if (sport === 'nba') {
    const nbaAwards = await fetchNbaPlayerAwards(name)
    if (nbaAwards.length > 0) honors = nbaAwards
  }

  return { sport, birthDate, birthPlace, teams, position, height, weight, jersey, nationality, age, currentTeamId, currentTeamLogo, career, honors, jerseyHistory }
}
 