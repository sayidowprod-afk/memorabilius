// « Carte que j'ai déjà » : sert à ne jamais proposer, dans le Trade Matching, une carte que le membre possède déjà.
// Même joueur, et mêmes année / marque / collection quand les deux côtés les renseignent ; la variation doit coïncider (une carte « Holo »
// n'est pas la carte de base) et la numérotation aussi quand les deux la renseignent.
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: unknown) => { const m = String(s ?? '').match(/\/(\d+)/); return m ? m[1] : norm(s) }

type Row = Record<string, any>

// Variation : strictement la même (« Refractor » et « Refractor Gold » sont deux cartes différentes ; vide contre renseignée aussi).
const sameVariation = (a: unknown, b: unknown) => norm(a) === norm(b)
// Numérotation : comparée seulement si les deux côtés l'ont (elle est souvent oubliée sur une des deux fiches) ; on compare le tirage (/99).
const sameNum = (a: unknown, b: unknown) => { const x = String(a ?? '').trim(), y = String(b ?? '').trim(); return !x || !y || normNum(x) === normNum(y) }

export function makeOwnedChecker(myCards: Row[]): (card: Row) => boolean {
  const byName = new Map<string, Row[]>()
  for (const c of myCards) { const k = norm(c.nom); if (k) byName.set(k, [...(byName.get(k) || []), c]) }
  const lenient = (a: unknown, b: unknown) => { const x = norm(a), y = norm(b); return !x || !y || x === y }
  return (card: Row) => (byName.get(norm(card.nom)) || []).some(m =>
    lenient(m.annee, card.annee) && lenient(m.marque, card.marque) && lenient(m.collection, card.collection) &&
    sameVariation(m.variation, card.variation) && sameNum(m.num, card.num),
  )
}
