import { SPORTS_TEAMS } from './sportsTeams'

// Normalise pour comparaison floue : le champ `equipe` des cartes est du texte
// libre (import CSV ou saisie manuelle), avec fautes/espaces/troncatures
// observées en base ("Detroit Piston ", "Atlanta Hawks " avec espace final,
// "Nets" seul sans ville...). On compare des tokens normalisés plutôt qu'une
// égalité stricte.
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const BASKETBALL_TEAM_NAMES = SPORTS_TEAMS.filter(t => t.sport === 'nba' || t.sport === 'wnba').map(t => normalize(t.name))

// Vrai si `equipe` (texte libre carte) désigne une équipe NBA/WNBA connue --
// égalité, ou inclusion dans un sens ou l'autre (ex: "Nets" ⊂ "brooklyn nets",
// "Detroit Piston" tronqué ⊂ "detroit pistons" en préfixe).
export function isBasketballTeam(equipe: string | null | undefined): boolean {
  if (!equipe) return false
  const n = normalize(equipe)
  if (!n) return false
  return BASKETBALL_TEAM_NAMES.some(team => team === n || team.includes(n) || n.includes(team) || team.startsWith(n) || n.startsWith(team))
}
