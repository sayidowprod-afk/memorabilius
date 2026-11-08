// « Carte que j'ai déjà » : sert à ne jamais proposer, dans le Trade Matching, une carte que le membre possède déjà.
// Même joueur, et mêmes année / marque / collection quand les deux côtés les renseignent ; variation et numérotation doivent être
// identiques (une carte « Holo » n'est pas la carte de base). Une carte différente par la variation reste donc proposée.
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normNum = (s: unknown) => { const m = String(s ?? '').match(/\/(\d+)/); return m ? m[1] : norm(s) }

type Row = Record<string, any>

export function makeOwnedChecker(myCards: Row[]): (card: Row) => boolean {
  const byName = new Map<string, Row[]>()
  for (const c of myCards) { const k = norm(c.nom); if (k) byName.set(k, [...(byName.get(k) || []), c]) }
  const lenient = (a: unknown, b: unknown) => { const x = norm(a), y = norm(b); return !x || !y || x === y }
  return (card: Row) => (byName.get(norm(card.nom)) || []).some(m =>
    lenient(m.annee, card.annee) && lenient(m.marque, card.marque) && lenient(m.collection, card.collection) &&
    norm(m.variation) === norm(card.variation) && normNum(m.num) === normNum(card.num),
  )
}
