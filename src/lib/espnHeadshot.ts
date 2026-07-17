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
}

// Ligue ESPN attendue par sport interne — sert à écarter les homonymes d'autres
// sports/ligues que l'API de recherche ESPN renvoie parfois (ex: chercher
// "Michael Jordan" en NBA retourne aussi un joueur de football universitaire
// du même nom ; "defaultLeagueSlug" permet de les distinguer précisément)
const LEAGUE_MAP: Record<string, string> = { nba: 'nba', nfl: 'nfl', nhl: 'nhl', mlb: 'mlb' }

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
}

async function findEspnAthleteId(name: string, sport: string): Promise<string | null> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const expectedLeague = LEAGUE_MAP[sport]
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return null
    const data = await r.json()
    const target = norm(name)
    let fallback: string | null = null
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        if (!a.displayName || norm(a.displayName) !== target || !a.uid) continue
        const m = /a:(\d+)/.exec(a.uid)
        if (!m) continue
        // Priorité à la ligue attendue ; sinon on garde en réserve (cas LeBron
        // James parfois classé "fiba" par ESPN malgré son profil NBA principal)
        if (expectedLeague && a.defaultLeagueSlug === expectedLeague) return m[1]
        if (!fallback) fallback = m[1]
      }
    }
    return fallback
  } catch { /* ESPN unavailable */ }
  return null
}

export async function fetchEspnPlayerBio(name: string, sport = 'nba'): Promise<EspnPlayerBio | null> {
  const league = LEAGUE_MAP[sport] || 'nba'
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const id = await findEspnAthleteId(name, sport)
  if (!id) return null

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

  return { birthDate, birthPlace, teams, position, height, weight, jersey, nationality, age, currentTeamId, currentTeamLogo, career, honors }
}
 