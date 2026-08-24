// Couleur d'accent par sport, reutilisee sur les tags/filtres pour scanner une
// liste mixte plus vite. Couvre les deux taxonomies existantes dans l'app :
// - annuaire/TeamBadge : 'nba' | 'wnba' | 'nfl' | 'mlb' | 'nhl' | 'football'
// - trades/TradeModal  : 'basket' | 'foot' | 'football_us' | 'baseball' | 'hockey' | 'pokemon' | 'tcg'
const SPORT_COLOR_MAP: Record<string, string> = {
  nba: '#e67e22', wnba: '#e67e22', basket: '#e67e22',
  football: '#27ae60', foot: '#27ae60',
  nfl: '#8b5a2b', football_us: '#8b5a2b',
  mlb: '#c0392b', baseball: '#c0392b',
  nhl: '#2980b9', hockey: '#2980b9',
  pokemon: '#f1c40f',
  tcg: '#8e44ad',
}

const DEFAULT_SPORT_COLOR = '#003DA6'

export function sportColor(key: string | null | undefined): string {
  if (!key) return DEFAULT_SPORT_COLOR
  return SPORT_COLOR_MAP[key.toLowerCase()] || DEFAULT_SPORT_COLOR
}
