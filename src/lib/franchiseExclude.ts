import { normalizeName } from '@/lib/playerSlug'
import exclusions from '@/data/franchise-exclude.json'

// [nom, premiere saison, derniere saison, nb d'entrees de checklist]
type Row = [string, number, number, number]

// Liste d'une franchise nettoyee :
//  - retire les noms listes dans src/data/franchise-exclude.json (joueurs qui n'ont jamais joue pour l'equipe, titres de cartes, trophees...
//    produits par une erreur d'equipe sur une carte de la checklist ; la liste est alimentee par scripts/verify-franchise.js) ;
//  - fusionne les doublons de saisie (« julius Erving » / « Julius Erving ») en gardant l'ecriture la plus soignee.
export function cleanFranchise(slug: string, rows: Row[]): Row[] {
  const ex = new Set(((exclusions as Record<string, string[]>)[slug] || []).map(n => normalizeName(n)))
  const merged = new Map<string, Row>()
  for (const r of rows) {
    const k = normalizeName(r[0])
    if (!k || ex.has(k)) continue
    const cur = merged.get(k)
    if (!cur) { merged.set(k, [...r] as Row); continue }
    const nice = (n: string) => (/^[A-Z]/.test(n) ? 1 : 0)
    const name = nice(r[0]) > nice(cur[0]) || (nice(r[0]) === nice(cur[0]) && r[3] > cur[3]) ? r[0] : cur[0]
    const y0 = cur[1] && r[1] ? Math.min(cur[1], r[1]) : cur[1] || r[1]
    merged.set(k, [name, y0, Math.max(cur[2], r[2]), cur[3] + r[3]])
  }
  return [...merged.values()]
}
