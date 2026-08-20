const SPORT_EMOJI: Record<string, string> = {
  nba: '🏀', basketball: '🏀',
  nfl: '🏈', football: '🏈',
  mlb: '⚾', baseball: '⚾',
  nhl: '🏒', hockey: '🏒',
  soccer: '⚽', 'soccer-international': '⚽', football_intl: '⚽',
  tennis: '🎾',
  mma: '🥊', ufc: '🥊', wrestling: '🤼',
  racing: '🏎️', f1: '🏎️', nascar: '🏎️',
  pokemon: '⚡', mtg: '🃏', tcg: '🃏',
}

export function sportEmoji(sport: string | null | undefined): string | null {
  if (!sport) return null
  return SPORT_EMOJI[sport.toLowerCase()] || null
}
