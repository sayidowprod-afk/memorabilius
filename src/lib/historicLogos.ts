// Logos des equipes disparues ou renommees (fichiers dans public/team-logos/hist-*).
// `src` : ancien logo de l'equipe ; `franchise` : sinon le logo de la franchise actuelle (id de sportsTeams).
export type HistoricLogo = { src?: string; franchise?: string }

const H = (f: string) => `/team-logos/${f}`
const MAP: Record<string, HistoricLogo> = {
  'seattle supersonics': { src: H('hist-seattle-supersonics.svg') },
  'vancouver grizzlies': { src: H('hist-vancouver-grizzlies.svg') },
  'new jersey nets': { src: H('hist-new-jersey-nets.png') },
  'new orleans jazz': { src: H('hist-new-orleans-jazz.png') },
  'buffalo braves': { src: H('hist-buffalo-braves.svg') },
  'san diego clippers': { src: H('hist-san-diego-clippers.png') },
  'new orleans hornets': { src: H('hist-new-orleans-hornets.gif') },
  'new orleans/oklahoma city hornets': { src: H('hist-new-orleans-hornets.gif') },
  'montreal expos': { src: H('hist-montreal-expos.svg') },
  'oakland raiders': { src: H('hist-oakland-raiders.svg') },
  'san diego chargers': { src: H('hist-san-diego-chargers.svg') },
  'cleveland indians': { src: H('hist-cleveland-indians.svg') },
  'oakland athletics': { src: H('hist-oakland-athletics.svg') },
  'phoenix coyotes': { src: H('hist-phoenix-coyotes.png') },
  'arizona coyotes': { src: H('hist-phoenix-coyotes.png') },
  // pas d'ancien logo disponible : logo de la franchise actuelle
  'washington bullets': { franchise: 'nba:WAS' },
  'charlotte bobcats': { franchise: 'nba:CHA' },
  'kansas city kings': { franchise: 'nba:SAC' },
  'kansas city-omaha kings': { franchise: 'nba:SAC' },
  'st. louis rams': { franchise: 'nfl:LAR' },
  'st louis rams': { franchise: 'nfl:LAR' },
  'anaheim angels': { franchise: 'mlb:LAA' },
  'california angels': { franchise: 'mlb:LAA' },
  'washington redskins': { franchise: 'nfl:WSH' },
  'washington football team': { franchise: 'nfl:WSH' },
}

export function historicLogo(name?: string | null): HistoricLogo | null {
  return MAP[(name || '').trim().toLowerCase()] || null
}
