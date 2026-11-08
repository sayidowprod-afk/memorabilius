import { SPORTS_TEAMS } from '@/lib/sportsTeams'

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '')

// Propositions de joueurs : noms exacts recensés sur le site (les mêmes que la recherche du haut de page).
export async function suggestPlayers(q: string): Promise<string[]> {
  const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const j = await res.json()
  return Array.isArray(j.players) ? j.players : []
}

// Propositions d'équipes : liste locale (NBA, NFL, MLB, NHL, foot…), sans appel réseau. Le début d'un mot compte (« 76 » → Philadelphia 76ers).
export function suggestTeams(q: string): string[] {
  const n = norm(q)
  if (!n) return []
  const out: { name: string; rank: number }[] = []
  const seen = new Set<string>()
  for (const t of SPORTS_TEAMS) {
    if (seen.has(t.name)) continue
    const name = norm(t.name), abbr = norm(t.abbr)
    const words = name.split(' ')
    const rank = name.startsWith(n) ? 0 : words.some(w => w.startsWith(n)) ? 1 : name.includes(n) ? 2 : abbr === n ? 1 : -1
    if (rank >= 0) { seen.add(t.name); out.push({ name: t.name, rank }) }
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(o => o.name)
}
