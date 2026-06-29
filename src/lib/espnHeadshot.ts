const SPORT_MAP: Record<string, string> = {
  nba:      'basketball',
  nfl:      'football',
  nhl:      'hockey',
  mlb:      'baseball',
  football: 'soccer',
}

// Retourne une Map nom.toLowerCase() → headshot URL
export async function fetchEspnHeadshots(
  query: string,
  sport = 'nba'
): Promise<Map<string, string>> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const result = new Map<string, string>()
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 86400 },
    } as RequestInit)
    if (!r.ok) return result
    const data = await r.json()
    for (const section of data.results || []) {
      for (const a of section.contents || []) {
        const name: string = a.displayName
        const photo: string | undefined = a.image?.default
        if (name && photo) result.set(name.toLowerCase(), photo)
      }
    }
  } catch { /* ESPN unavailable */ }
  return result
}

// Retourne le headshot d'un joueur précis
export async function fetchEspnHeadshot(name: string, sport = 'nba'): Promise<string | null> {
  const map = await fetchEspnHeadshots(name, sport)
  if (map.size === 0) return null
  const lower = name.toLowerCase()
  return (
    map.get(lower) ||
    [...map.entries()].find(([k]) => k.includes(lower) || lower.includes(k))?.[1] ||
    null
  )
}
