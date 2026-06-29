const SPORT_PATH: Record<string, string> = {
  nba: 'basketball/nba',
  nfl: 'football/nfl',
  nhl: 'hockey/nhl',
  mlb: 'baseball/mlb',
  football: 'soccer/esp.1', // fallback for football
}

// Retourne une Map nom.toLowerCase() → headshot URL pour un query donné
export async function fetchEspnHeadshots(
  query: string,
  sport = 'nba'
): Promise<Map<string, string>> {
  const path = SPORT_PATH[sport] || SPORT_PATH.nba
  const result = new Map<string, string>()
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/${path}/athletes?searchTerm=${encodeURIComponent(query)}&limit=20`,
      { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } } as RequestInit
    )
    if (!r.ok) return result
    const data = await r.json()
    for (const a of data.athletes || []) {
      if (a.headshot?.href && a.displayName) {
        result.set(a.displayName.toLowerCase(), a.headshot.href)
      }
    }
  } catch { /* ESPN unavailable */ }
  return result
}

// Retourne l'URL du headshot d'un joueur précis (pour la page joueur)
export async function fetchEspnHeadshot(name: string, sport = 'nba'): Promise<string | null> {
  const map = await fetchEspnHeadshots(name, sport)
  if (map.size === 0) return null
  // Cherche correspondance exacte puis partielle
  const lower = name.toLowerCase()
  return map.get(lower) || [...map.entries()].find(([k]) => k.includes(lower) || lower.includes(k))?.[1] || null
}
