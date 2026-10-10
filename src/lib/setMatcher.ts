// UNIQUE moteur de correspondance carte de galerie -> entree de setlist, partage par :
//   - src/app/api/set-sync/route.ts   (synchronisation d'un set, ecrit les validations)
//   - src/app/setlist/page.tsx        (synchronisation de tous les sets d'un sport)
// Avant, chaque endroit avait sa propre logique (de plus en plus souple), d'ou les cartes validees en double, dans les
// mauvais sets, avec les mauvaises images.
//
// Regles (strictes : mieux vaut laisser une carte "non placee" que valider la mauvaise) :
//  - TOUTES les entrees sont comparees (base ET paralleles : une carte Gold valide l'entree Gold, pas la base) ;
//  - joueur identique ; annee compatible (OBLIGATOIRE si le set a une annee) ; marque compatible ;
//  - collection : les mots "produit" de la carte (hors marque, annee, mots generiques) doivent etre EXACTEMENT ceux du set ;
//  - numero de carte identique quand les deux sont renseignes ;
//  - si plusieurs entrees / plusieurs sets restent possibles : on choisit la plus specifique, sinon on ne coche rien.

export interface MSet { id: number; name: string; year: number | null; brand: string | null }
export interface MEntry { id: number; player_name: string; variation: string | null; set_id: number; card_number: string | null }
export interface MCard { nom: string; annee?: string | null; marque?: string | null; collection?: string | null; collection_tag?: string | null; variation?: string | null; card_number?: string | null; set_entry_id?: number | null }

const stripD = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
export const norm = (s: string | null | undefined) => (s ? stripD(s).toLowerCase().replace(/[^a-z0-9]/g, '') : '')
const wordsOf = (s: string | null | undefined) => (s ? stripD(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1) : [])

const BRAND_PARENT: Record<string, string> = {
  hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini', optic: 'panini', mosaic: 'panini', chronicles: 'panini',
  contenders: 'panini', spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini', revolution: 'panini',
  eminence: 'panini', illusions: 'panini', nbahoops: 'panini', flawless: 'panini', titanium: 'panini', nationaltreasures: 'panini',
  flux: 'panini', origins: 'panini', courtkings: 'panini', certified: 'panini',
  flagship: 'topps', finest: 'topps', bowman: 'topps', chrome: 'topps', heritage: 'topps', stadium: 'topps', update: 'topps',
}
const GENERIC = new Set(['panini', 'topps', 'upperdeck', 'upper', 'deck', 'nba', 'nfl', 'mlb', 'nhl', 'basketball', 'football', 'baseball', 'hockey', 'cards', 'card', 'the', 'and'])
// noms colloquiels equivalents (remplaces AVANT le decoupage en mots)
const ALIASES: [RegExp, string][] = [
  [/\bnba\s+hoops\b/gi, 'hoops'], [/\btopps\s+flagship\b/gi, 'flagship'], [/\bdonruss\s+optic\b/gi, 'optic'], [/\bpanini\s+prizm\b/gi, 'prizm'],
]
const aliased = (s: string) => ALIASES.reduce((t, [re, to]) => t.replace(re, to), s)
const stem = (w: string) => w.replace(/s$/, '')
const EXPAND: Record<string, string> = { auto: 'autograph', ref: 'refractor', sp: 'shortprint', mem: 'memorabilia', rpa: 'rookiepatchautograph' }

export function normBrand(b: string | null | undefined) {
  const n = norm(b).replace('america', '').replace('sports', '')
  return BRAND_PARENT[n] ?? n
}

// L'annee d'un set est TOUJOURS l'annee de debut de saison (6 009 sets verifies : "2023-24 ..." = 2023). On accepte "2023",
// "2023-24", "2023-2024", "23-24" ; surtout pas la saison d'avant/apres (sinon "2014-15" validait aussi le set 2015-16).
function yearOk(cardYear: string, y: number): boolean {
  const cy = cardYear.trim()
  if (!cy) return false
  const ys = String(y)
  return [ys, `${y}-${String(y + 1).slice(2)}`, `${y}-${y + 1}`, `${ys.slice(2)}-${String(y + 1).slice(2)}`].includes(cy)
}

// mots "produit" d'un texte de collection ou d'un nom de set, hors marque du set / annee / mots generiques
function productWords(text: string, brandWords: Set<string>): Set<string> {
  return new Set(
    wordsOf(aliased(text)).map(stem).filter(w => w.length > 1 && !/^\d+$/.test(w) && !GENERIC.has(w) && !brandWords.has(w)),
  )
}
const brandWordsOf = (set: MSet) => new Set([...wordsOf(set.brand || '').map(stem), ...wordsOf(BRAND_PARENT[norm(set.brand)] || '').map(stem), 'panini', 'topps', 'upper', 'deck', 'upperdeck'])

// Variation : 0 = identique (memes mots), 1 = la carte decrit au moins la moitie des mots de l'entree (ex. "Gold" ~ "Gold Prizm"),
// null = incompatible. Une carte SANS variation ne correspond qu'a une entree SANS variation (la base).
function variationScore(cardVar: string, entryVar: string): number | null {
  const cw = new Set(wordsOf(cardVar).map(w => EXPAND[w] ?? w)), ew = new Set(wordsOf(entryVar).map(w => EXPAND[w] ?? w))
  if (cw.size === 0 && ew.size === 0) return 0
  if (cw.size === 0 || ew.size === 0) return null
  const same = cw.size === ew.size && [...cw].every(w => ew.has(w))
  if (same) return 0
  if ([...cw].every(w => ew.has(w)) && cw.size / ew.size >= 0.5) return 1
  return null
}

/** Entrees (deja filtrees sur le joueur) compatibles avec la carte, reduites a la plus plausible PAR SET. */
export function candidatesForCard(card: MCard, playerRoots: MEntry[], sets: Map<number, MSet>): MEntry[] {
  const coll = (card.collection || card.collection_tag || '').trim()
  if (!coll) return []                                    // sans collection on ne devine pas
  const bySet = new Map<number, MEntry[]>()
  for (const e of playerRoots) {
    const set = sets.get(e.set_id)
    if (!set) continue
    if (card.set_entry_id != null && card.set_entry_id !== e.id) continue
    if (set.year && !yearOk(card.annee || '', set.year)) continue
    if (set.brand && card.marque) {
      const nb = normBrand(card.marque), ns = normBrand(set.brand)
      if (!nb.includes(ns) && !ns.includes(nb)) continue
    }
    const bw = brandWordsOf(set)
    const a = productWords(coll, bw), b = productWords(set.name, bw)
    if (a.size !== b.size || ![...a].every(w => b.has(w))) continue
    const arr = bySet.get(e.set_id) || []
    arr.push(e); bySet.set(e.set_id, arr)
  }
  const out: MEntry[] = []
  for (const arr of bySet.values()) {
    let c = arr
    const cn = norm(card.card_number)
    if (cn) {
      const exact = c.filter(e => norm(e.card_number) === cn)
      c = exact.length ? exact : c.filter(e => !e.card_number)
    }
    // variation : on garde les meilleures (score le plus bas)
    const scored = c.map(e => ({ e, v: variationScore(card.variation || '', e.variation || '') })).filter(x => x.v !== null) as { e: MEntry; v: number }[]
    const best = Math.min(Infinity, ...scored.map(x => x.v))
    if (scored.length) out.push(...scored.filter(x => x.v === best).map(x => x.e))
    else if (cn) {
      // la variation de la carte n'existe pas sous ce nom dans la checklist (noms differents d'une source a l'autre) mais le NUMERO
      // correspond exactement : on retombe sur la carte de base portant ce numero (jamais sur un parallele au hasard)
      out.push(...c.filter(e => norm(e.card_number) === cn && !(e.variation || '').trim()))
    }
  }
  return out
}

/** Entree choisie, ou null si ambigu (plusieurs possibilites a egalite) / introuvable. */
export function pickEntry(cands: MEntry[]): MEntry | null {
  return cands.length === 1 ? cands[0] : null
}

/** Niveau SET seulement (sans entrees) : ce set peut-il correspondre a cette carte ? Sert a ne charger QUE les entrees utiles.
 *  `loose` = test large pour proposer des sets en placement manuel (annee + au moins un mot produit en commun). */
export function setCouldMatchCard(card: MCard, set: MSet, loose = false): boolean {
  const coll = (card.collection || card.collection_tag || '').trim()
  if (!coll) return false
  if (set.year && !yearOk(card.annee || '', set.year)) return false
  if (set.brand && card.marque) {
    const nb = normBrand(card.marque), ns = normBrand(set.brand)
    if (!nb.includes(ns) && !ns.includes(nb)) return false
  }
  const bw = brandWordsOf(set)
  const a = productWords(coll, bw), b = productWords(set.name, bw)
  if (loose) return [...a].some(w => b.has(w)) || (a.size === 0 && b.size === 0)
  return a.size === b.size && [...a].every(w => b.has(w))
}
