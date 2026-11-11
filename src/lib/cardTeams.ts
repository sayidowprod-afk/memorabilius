// Cartes multi-équipes : une carte (échange, anciens coéquipiers…) peut porter plusieurs équipes séparées par « / »,
// par exemple « Boston Celtics / Philadelphia 76ers / Toronto Raptors ».
// Dans les listes et les filtres, chaque équipe est proposée SEULE (jamais la chaîne complète), et la carte est trouvée dans chacune d'elles.

export function splitTeams(t?: string | null): string[] {
  return [...new Set((t || '').split('/').map(s => s.trim()).filter(Boolean))]
}

// liste triée de toutes les équipes distinctes, chaque équipe d'une carte multi-équipes comptée séparément
export function teamList(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) for (const t of splitTeams(v)) set.add(t)
  return [...set].sort()
}

// la carte compte-t-elle cette équipe parmi les siennes ? (égalité exacte sur l'une des équipes, comparaison sans tenir compte de la casse)
export function hasTeam(t: string | null | undefined, team: string): boolean {
  const q = team.trim().toLowerCase()
  if (!q) return true
  return splitTeams(t).some(p => p.toLowerCase() === q)
}
