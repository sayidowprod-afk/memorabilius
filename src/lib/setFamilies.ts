// "Familles" de cartes d'une setlist : les checklists contiennent la carte de base ET tous ses paralleles (/150, Gold, Silver Prizm...)
// comme autant d'entrees. Pour le collectionneur c'est LA MEME carte (meme joueur, meme numero) : on ne garde qu'une entree par carte,
// la "racine" -- celle dont la variation est la plus courte (la base, sinon l'insert), les autres variations en sont des paralleles.
// Entrees SANS numero de carte : jamais regroupees (trop risque de fusionner des cartes differentes).
export interface FamilyEntry { id: number; player_name: string | null; variation: string | null; card_number: string | null }

const norm = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const words = (s: string | null | undefined) => new Set((s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1))

export function rootEntryIds(entries: FamilyEntry[]): Set<number> {
  const groups = new Map<string, FamilyEntry[]>()
  const roots = new Set<number>()
  for (const e of entries) {
    const cn = norm(e.card_number)
    if (!cn) { roots.add(e.id); continue }
    const k = `${norm(e.player_name)}|${cn}`
    const g = groups.get(k)
    if (g) g.push(e); else groups.set(k, [e])
  }
  for (const g of groups.values()) {
    if (g.length === 1) { roots.add(g[0].id); continue }
    const ws = g.map(e => words(e.variation))
    const seen = new Set<string>()
    g.forEach((e, i) => {
      // racine = aucune autre variation du groupe n'est un sous-ensemble STRICT de la sienne
      const isParallel = ws.some((o, j) => j !== i && o.size < ws[i].size && [...o].every(w => ws[i].has(w)))
      if (isParallel) return
      const key = [...ws[i]].sort().join(' ')
      if (seen.has(key)) return        // doublon exact (meme variation) : une seule entree
      seen.add(key); roots.add(e.id)
    })
  }
  return roots
}
