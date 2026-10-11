// Logos des equipes disparues ou renommees (fichiers dans public/team-logos/hist-*).
// `src` : fichier de l'ancien logo ; `base` : meme chose sans extension (essaie .png, .svg, .webp, .gif) ; `franchise` : uniquement quand l'equipe a le meme nom que l'actuelle (id de sportsTeams).
export type HistoricLogo = { src?: string; base?: string; franchise?: string }

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
  // meme nom que la franchise actuelle (LA Clippers dans la liste)
  'los angeles clippers': { franchise: 'nba:LAC' },
  // pas encore de fichier : deposer public/team-logos/hist-<nom>.png (ou .svg / .webp / .gif) et le logo apparait tout seul
  'washington bullets': { base: H('hist-washington-bullets') },
  'charlotte bobcats': { base: H('hist-charlotte-bobcats') },
  'kansas city kings': { base: H('hist-kansas-city-kings') },
  'kansas city-omaha kings': { base: H('hist-kansas-city-kings') },
  'st. louis rams': { base: H('hist-st-louis-rams') },
  'st louis rams': { base: H('hist-st-louis-rams') },
  'anaheim angels': { base: H('hist-anaheim-angels') },
  'california angels': { base: H('hist-california-angels') },
  'washington redskins': { base: H('hist-washington-redskins') },
  'washington football team': { base: H('hist-washington-football-team') },
}

export function historicLogo(name?: string | null): HistoricLogo | null {
  return MAP[(name || '').trim().toLowerCase()] || null
}
