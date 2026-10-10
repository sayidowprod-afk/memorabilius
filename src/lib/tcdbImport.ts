// Rapprochement des lignes d'un PDF TCDB avec nos sets / entrees de checklist (cote serveur, strict : on coche seulement les
// cartes retrouvees sans ambiguite, le reste est renvoye a l'utilisateur dans "non reconnues").
import { norm } from '@/lib/setMatcher'

export interface ISet { id: number; name: string; year: number | null; sport: string | null }
export interface IEntry { id: number; card_number: string | null; player_name: string; variation: string | null; set_id: number }

const NUM_TOKEN = /^(\d+[a-zA-Z]?|[A-Za-z]{1,6}-?[A-Za-z]{0,3}\d+[a-zA-Z]?|[A-Za-z]{1,6}-[A-Za-z]{1,4})$/
const TAG_TOKEN = /^(RC|AU|SP|VAR|ART|CL|SSP|ERR|COR|INS|MEM|PATCH|AUTO|NUM|RPA|SN\d+|DP|FOIL)$/i
const stripTags = (words: string[]) => { const w = [...words]; while (w.length > 1 && TAG_TOKEN.test(w[w.length - 1].replace(/,$/, ''))) w.pop(); return w }
const words = (s: string) => s.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean)

/** Sports TCDB ("Soccer", "Basketball"...) -> valeurs de card_sets.sport */
export function sportsForTcdb(label: string | null): string[] | null {
  const l = (label || '').toLowerCase()
  if (!l) return null
  if (/basket/.test(l)) return ['nba', 'wnba', 'euro-basketball']
  if (/soccer|football \(soccer\)/.test(l)) return ['soccer-international']
  if (/^football/.test(l)) return ['nfl']
  if (/baseball/.test(l)) return ['baseball']
  if (/hockey/.test(l)) return ['hockey']
  if (/racing/.test(l)) return ['racing']
  if (/tennis/.test(l)) return ['tennis']
  if (/wrestling/.test(l)) return ['wrestling']
  if (/mma|boxing|ufc/.test(l)) return ['mma']
  return null
}

function startYear(text: string): number | null {
  const m = text.match(/^(\d{4})/)
  return m ? parseInt(m[1]) : null
}

export interface Parsed { setId: number; num: string; variation: string; name: string }

/** Decoupe "<set> [insert/parallele] <numero> <joueur> [tags]" en utilisant NOS noms de sets (plus long prefixe) */
export function resolveCollectionLine(text: string, sets: ISet[]): Parsed | { error: 'set' | 'num' } {
  const y = startYear(text)
  const tw = words(text)
  let best: { set: ISet; len: number } | null = null
  for (const s of sets) {
    if (y != null && s.year != null && s.year !== y) continue
    const sw = words(s.name)
    if (sw.length > tw.length - 2) continue
    let ok = true
    for (let i = 0; i < sw.length; i++) if (norm(sw[i]) !== norm(tw[i])) { ok = false; break }
    if (ok && (!best || sw.length > best.len)) best = { set: s, len: sw.length }
  }
  if (!best) return { error: 'set' }
  const rest = tw.slice(best.len)
  // le numero = premier mot "numero" suivi d'au moins un mot (le joueur) ; avant lui : nom de l'insert / du parallele
  for (let i = 0; i < rest.length - 1; i++) {
    if (NUM_TOKEN.test(rest[i])) {
      const nameWords = stripTags(rest.slice(i + 1))
      return { setId: best.set.id, num: rest[i], variation: rest.slice(0, i).join(' '), name: nameWords.join(' ') }
    }
  }
  return { error: 'num' }
}

const nameKey = (s: string) => norm(s)
/** Les noms TCDB et les notres divergent un peu (Jr., accents) : on exige qu'un des deux contienne l'autre, ou meme nom de famille */
export function sameName(a: string, b: string): boolean {
  const x = nameKey(a), y = nameKey(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const la = norm(words(a).filter(w => !/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).slice(-1)[0] || '')
  const lb = norm(words(b).filter(w => !/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).slice(-1)[0] || '')
  return la.length > 3 && la === lb
}

/** Entree de checklist correspondant a (set, numero, variation) ; null si absente ou ambigue */
export function findEntry(entries: IEntry[], p: { num: string; variation: string; name: string }): IEntry | null {
  const n = norm(p.num), v = norm(p.variation)
  const c = entries.filter(e => norm(e.card_number) === n && norm(e.variation) === v)
  if (c.length === 1) return c[0]
  if (c.length > 1) {
    const byName = c.filter(e => sameName(e.player_name, p.name))
    return byName.length === 1 ? byName[0] : null
  }
  return null
}
