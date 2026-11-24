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
// Cle de NOM de joueur : sans accents, sans « Jr. / Sr. / II / III / IV » ni ponctuation (« Luka Dončić » = « Luka Doncic », « Mike Dunleavy Jr. » = « Mike Dunleavy »)
export const nameKey = (s: string | null | undefined) => norm((s || '').replace(/\([^)]*\)/g, ' ').replace(/[,.]?\s+(jr|sr|ii|iii|iv)\.?\s*$/i, ''))
/** Ecritures possibles d'un nom dans la base des checklists (pour les requetes « player_name IN (...) »). */
export function nameVariants(nom: string): string[] {
  const base = (nom || '').trim()
  if (!base) return []
  const plain = stripD(base)
  const core = plain.replace(/[,.]?\s+(jr|sr|ii|iii|iv)\.?\s*$/i, '').trim()
  const out = new Set<string>([base, plain, core])
  for (const suf of ['Jr.', 'Sr.', 'II', 'III', 'Jr', 'Sr']) { out.add(`${core} ${suf}`); out.add(`${base} ${suf}`) }
  return [...out].filter(Boolean)
}
const wordsOf = (s: string | null | undefined) => (s ? stripD(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1) : [])

const BRAND_PARENT: Record<string, string> = {
  hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini', optic: 'panini', mosaic: 'panini', chronicles: 'panini',
  contenders: 'panini', spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini', revolution: 'panini',
  eminence: 'panini', illusions: 'panini', nbahoops: 'panini', flawless: 'panini', titanium: 'panini', nationaltreasures: 'panini',
  flux: 'panini', origins: 'panini', courtkings: 'panini', certified: 'panini',
  flagship: 'topps', finest: 'topps', bowman: 'topps', chrome: 'topps', heritage: 'topps', stadium: 'topps', update: 'topps',
}
const GENERIC = new Set(['panini', 'topps', 'upperdeck', 'upper', 'deck', 'nba', 'nfl', 'mlb', 'nhl', 'basketball', 'football', 'baseball', 'hockey', 'cards', 'card', 'the', 'and', 'fleer', 'skybox', 'ud'])
// noms colloquiels equivalents (remplaces AVANT le decoupage en mots)
const ALIASES: [RegExp, string][] = [
  [/\bnba\s+hoops\b/gi, 'hoops'], [/\btopps\s+flagship\b/gi, 'flagship'], [/\bdonruss\s+optic\b/gi, 'optic'], [/\bpanini\s+prizm\b/gi, 'prizm'],
]
const aliased = (s: string) => ALIASES.reduce((t, [re, to]) => t.replace(re, to), s)
// mots qui ne désignent PAS un produit : « Base », « Series 1 », noms d'équipes (la collection est parfois saisie comme l'équipe du joueur)
const TEAM_WORDS = new Set(('hawks celtics nets hornets bulls cavaliers mavericks nuggets pistons warriors rockets pacers clippers lakers grizzlies heat bucks timberwolves pelicans knicks thunder magic sixers 76ers suns blazers kings spurs raptors jazz wizards ' +
  'ducks coyotes bruins sabres flames hurricanes blackhawks avalanche jackets stars wings oilers panthers kraken wild canadiens predators devils islanders rangers senators flyers penguins sharks blues lightning leafs canucks knights capitals jets ' +
  'cardinals falcons ravens bills panthers bears bengals browns cowboys broncos lions packers texans colts jaguars chiefs raiders chargers rams dolphins vikings patriots saints giants jets eagles steelers niners seahawks buccaneers titans commanders ' +
  'orioles sox redsox whitesox guardians tigers astros royals angels twins yankees athletics mariners rays rangers jays braves marlins mets phillies nationals cubs reds brewers pirates dodgers padres rockies diamondbacks ' +
  'atlanta boston brooklyn charlotte chicago cleveland dallas denver detroit golden state houston indiana los angeles memphis miami milwaukee minnesota new orleans york oklahoma city orlando philadelphia phoenix portland sacramento san antonio toronto utah washington ' +
  'anaheim arizona buffalo calgary carolina colorado columbus edmonton florida montreal nashville jersey ottawa pittsburgh seattle tampa bay vancouver vegas winnipeg').split(/\s+/))
const NOISE_COLL = new Set(['base', 'series', 'one', 'two', 'three', 'set', 'regular', 'main', 'basic', 'standard', 'flagship'])
const inNoise = (w: string) => NOISE_COLL.has(w) || NOISE_COLL.has(w + 's') || TEAM_WORDS.has(w) || TEAM_WORDS.has(w + 's')
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
// 0 = annee exacte ; 1 = la carte porte seulement l'annee de FIN de saison (« 2026 » pour le set « 2025-26 ») ; null = autre annee
function yearTier(cardYear: string, set: MSet): 0 | 1 | null {
  if (!set.year) return 0
  if (yearOk(cardYear, set.year)) return 0
  if (/^\d{4}$/.test(cardYear.trim()) && Number(cardYear) === set.year + 1 && /^\s*\d{4}\s*-\s*\d{2}/.test(set.name)) return 1
  return null
}
// numero de carte compare : « #3 », « 3 of 10 », « 4/10 » -> « 3 », « 4 »
const numKey = (n: string | null | undefined) => norm(String(n ?? '').replace(/^#/, '').replace(/\s*(?:of|\/)\s*\d+\s*$/i, ''))

// mots "produit" d'un texte de collection ou d'un nom de set, hors marque du set / annee / mots generiques
function productWords(text: string, brandWords: Set<string>): Set<string> {
  return new Set(
    wordsOf(aliased(text)).map(stem).filter(w => w.length > 1 && !/^\d+$/.test(w) && !GENERIC.has(w) && !GENERIC.has(w + 's') && !brandWords.has(w) && !brandWords.has(w + 's')),
  )
}
// collection de la CARTE : « Origins WNBA - Water Color » = collection « Origins WNBA » + variation « Water Color » ; le bruit (Base, équipe…) est ignoré
function splitCollection(raw: string): { coll: string; extraVar: string } {
  const m = raw.split(/\s+[-–]\s*|\s*[-–]\s+/)
  return { coll: (m[0] || '').trim(), extraVar: m.slice(1).join(' ').trim() }
}
const brandWordsOf = (set: MSet) => new Set([...wordsOf(set.brand || '').map(stem), ...wordsOf(BRAND_PARENT[norm(set.brand)] || '').map(stem), 'panini', 'topps', 'upper', 'deck', 'upperdeck'])

/** Collection de la carte comparee au nom du set. ok = memes mots « produit » ; rest = mots de la carte en plus (un insert saisi comme collection, ex. « Fifth Anniversary » dans « Hoops »). */
function compareCollection(coll: string, card: MCard, set: MSet): { ok: boolean; rest: string } {
  const bw = new Set([...brandWordsOf(set), ...wordsOf(card.marque || '').map(stem)])
  const b = productWords(set.name, bw)
  const same = (a: Set<string>) => a.size === b.size && [...a].every(w => b.has(w))
  const pw = new Set(wordsOf(card.nom).map(stem))
  // la marque saisie (« Topps », « Upper Deck », « NBA Hoops ») figure-t-elle dans le nom / la marque du set ? Sert quand la collection ne dit rien :
  // sans cela, « 2007-08 Topps » validait aussi Bowman, Finest, Fleer, Hoops (toutes des « bases » sans mot produit)
  const mWords = wordsOf(card.marque || '').map(stem).filter(w => !['nba', 'nfl', 'nhl', 'mlb', 'wnba', 'basketball', 'football', 'hockey', 'baseball'].includes(w))
  const setTok = new Set(wordsOf(`${set.name} ${set.brand || ''}`).map(stem))
  const marqueIn = mWords.length > 0 && mWords.every(w => setTok.has(w))
  // la collection apporte-t-elle une information (hors marque generique, bruit, equipe, nom du joueur) ?
  const info = [...productWords(coll, new Set<string>())].filter(w => !inNoise(w) && !pw.has(w))
  const raw = productWords(coll, bw)
  if (same(raw)) return info.length || marqueIn ? { ok: true, rest: '' } : { ok: false, rest: '' }
  // sans le bruit : « Base », « Series 1 », équipe du joueur, nom du joueur
  const clean = new Set([...raw].filter(w => !inNoise(w) && !pw.has(w)))
  if (same(clean)) return info.length || marqueIn ? { ok: true, rest: '' } : { ok: false, rest: '' }
  // le set est la base (aucun mot produit) du fabricant saisi et la carte nomme un insert : on garde ces mots comme variation
  if (b.size === 0 && marqueIn && clean.size > 0) return { ok: true, rest: [...clean].join(' ') }
  return { ok: false, rest: '' }
}

// Variation : 0 = identique (memes mots), 1 = la carte decrit au moins la moitie des mots de l'entree (ex. "Gold" ~ "Gold Prizm"),
// null = incompatible. Une carte SANS variation ne correspond qu'a une entree SANS variation (la base).
// mots d'une variation : alias développés, pluriels ramenés au singulier, et mots qui n'apportent rien (« China Variation » = « China »)
const NOISE = new Set(['variation', 'variations', 'parallel', 'parallels'])
// les chiffres seuls comptent (« Row 1 » n'est pas « Row 2 »), contrairement aux autres mots d'une lettre
const varTokens = (v: string) => stripD(v || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 || /^\d$/.test(w))
const varWords = (v: string, strip?: Set<string>) => new Set(varTokens(v).map(w => EXPAND[w] ?? w).map(w => (/^\d+$/.test(w) ? w : stem(w))).filter(w => !NOISE.has(w) && !(strip && strip.has(w))))
const lev1 = (a: string, b: string) => {   // distance d'edition <= 1
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i)
}
const wEq = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && lev1(a, b))
const hasW = (set: Set<string>, w: string) => { for (const x of set) if (wEq(x, w)) return true; return false }
// mots decoratifs qu'un membre ajoute au nom d'une variation sans changer la carte (« Marquee Teal » = « Teal »)
const DECOR = new Set(['edition', 'icon', 'association', 'statement', 'city', 'national', 'pride', 'marquee', 'retail', 'hobby', 'base', 'parallel', 'insert', 'version', 'prizm', 'ssp', 'sp', 'card', 'first'])
// mots qui signalent un PARALLELE (couleur, finition) : une carte qui en porte un ne doit jamais retomber sur une autre ligne
const PARALLEL_WORDS = new Set(['gold', 'silver', 'bronze', 'blue', 'red', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'teal', 'yellow', 'aqua', 'jade', 'copper', 'platinum', 'holo', 'hyper', 'refractor', 'prizm', 'wave', 'shimmer', 'foil', 'mojo', 'ice', 'cracked', 'disco', 'laser', 'pulsar', 'scope', 'sparkle', 'zebra', 'camo', 'tiger', 'fluorescent', 'neon', 'rainbow', 'superfractor', 'xfractor', 'artist', 'proof', 'printing', 'plate', 'ruby', 'sapphire', 'emerald', 'onyx'])

function variationScore(cardVar: string, entryVar: string, strip?: Set<string>): number | null {
  const cw = varWords(cardVar, strip), ew = varWords(entryVar, strip)
  if (cw.size === 0 && ew.size === 0) return 0
  if (cw.size === 0 || ew.size === 0) return null
  const cin = [...cw].every(w => hasW(ew, w)), ein = [...ew].every(w => hasW(cw, w))
  if (cin && ein) return [...cw].every(w => ew.has(w)) && cw.size === ew.size ? 0 : 0.5       // 0.5 = identique a une faute de frappe pres
  if (cin && cw.size / ew.size >= 0.5) return 1
  if (ein && ew.size / cw.size >= 0.5 && [...cw].filter(w => !hasW(ew, w)).every(w => DECOR.has(w))) return 2
  return null
}


// la marque du SET est-elle incompatible avec celle de la carte ? Seulement si le set est nomme d'apres un FABRICANT (Panini, Topps, Upper Deck...).
// Quand le « brand » du set est un nom de produit (Hoops, Parkhurst, Finest, Score...) il n'indique pas le fabricant : la saisie « Topps NBA Hoops » (Topps a repris Hoops en 2025)
// ou « Upper Deck Parkhurst » est tout a fait normale.
const MAKERS = new Set(['panini', 'topps', 'upperdeck'])
function brandConflict(card: MCard, set: MSet): boolean {
  if (!set.brand || !card.marque) return false
  const rawS = norm(set.brand).replace('america', '').replace('sports', '')
  if (!MAKERS.has(rawS)) return false
  const nb = normBrand(card.marque)
  if (!MAKERS.has(nb) && !MAKERS.has(norm(card.marque))) return false
  return !(nb.includes(rawS) || rawS.includes(nb))
}
function collectionOf(card: MCard) {
  const raw = (card.collection || card.collection_tag || '').trim()
  return splitCollection(raw)
}

/** Entrees (deja filtrees sur le joueur) compatibles avec la carte, reduites a la plus plausible PAR SET. */
export function candidatesForCard(card: MCard, playerRoots: MEntry[], sets: Map<number, MSet>): MEntry[] {
  const { coll, extraVar } = collectionOf(card)
  const own = (card.variation || '').trim().toLowerCase() === 'base' ? '' : (card.variation || '').trim()
  const bySet = new Map<number, MEntry[]>()
  const restBySet = new Map<number, string>()
  const tierBySet = new Map<number, 0 | 1>()
  for (const e of playerRoots) {
    const set = sets.get(e.set_id)
    if (!set) continue
    if (card.set_entry_id != null && card.set_entry_id !== e.id) continue
    const yt = yearTier(card.annee || '', set)
    if (yt === null) continue
    if (brandConflict(card, set)) continue
    const cc = compareCollection(coll, card, set)
    if (!cc.ok) continue
    restBySet.set(e.set_id, cc.rest); tierBySet.set(e.set_id, yt)
    const arr = bySet.get(e.set_id) || []
    arr.push(e); bySet.set(e.set_id, arr)
  }
  const out: MEntry[] = []
  const cn = numKey(card.card_number)
  for (const [sid, arr] of bySet.entries()) {
    let c = arr
    if (tierBySet.get(sid) === 1) {              // annee de fin de saison seulement : on exige le numero exact
      if (!cn || !c.some(e => numKey(e.card_number) === cn)) continue
    }
    if (cn) {
      const exact = c.filter(e => numKey(e.card_number) === cn)
      c = exact.length ? exact : c.filter(e => !e.card_number)
    }
    const rest = restBySet.get(sid) || ''
    // variation de la carte : sa variation + le texte accole a la collection (« Prizm WNBA - Hall Monitors » + « Green »)
    const vTxt = [extraVar, own, rest].filter(Boolean).join(' ')
    const pick = (vt: string, strip?: Set<string>) => {
      const sc = c.map(e => ({ e, v: variationScore(vt, e.variation || '', strip) })).filter(x => x.v !== null) as { e: MEntry; v: number }[]
      if (!sc.length) return []
      const best = Math.min(...sc.map(x => x.v))
      return sc.filter(x => x.v === best).map(x => x.e)
    }
    // essais de plus en plus souples ; jamais « au hasard »
    const setW = productWords(sets.get(sid)?.name || '', new Set<string>())
    const strip = new Set<string>([...setW, 'prizm', 'prizms'])
    let r = pick(vTxt)
    if (!r.length && !rest && vTxt !== own) r = pick(own)               // texte accole a la collection (« Magic 93/94 ») : ignore (jamais quand la collection nomme un insert)
    if (!r.length && vTxt) r = pick(vTxt, strip)                         // « Green Mosaic Prizm » ~ « Green Mosaic » : mots du produit ignores
    if (!r.length && cn) {
      // le NUMERO n'existe qu'une fois dans ce set pour ce joueur : c'est cette ligne, sauf si la carte porte un mot de PARALLELE
      // (une Gold ne doit pas retomber sur la base) ; une carte sans variation (« NL-12 », « RC-4 ») ou avec un simple intitule (« All-Star ») passe
      const byNum = c.filter(e => numKey(e.card_number) === cn)
      const parallelish = [...varWords(vTxt)].some(w => PARALLEL_WORDS.has(w))
      if (byNum.length === 1 && !parallelish && !rest) r = byNum
    }
    out.push(...r)
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
  const { coll } = collectionOf(card)
  if (yearTier(card.annee || '', set) === null) return false
  if (brandConflict(card, set)) return false
  if (compareCollection(coll, card, set).ok) return true
  if (!loose) return false
  const bw = new Set([...brandWordsOf(set), ...wordsOf(card.marque || '').map(stem)])
  const a = productWords(coll, bw), b = productWords(set.name, bw)
  return [...a].some(w => b.has(w)) || (a.size === 0 && b.size === 0)
}

/** Variation IDENTIQUE (mêmes mots, après alias). Pour une PHOTO affichée sur une ligne : « Gold » n'est pas « Gold Prizm » ni « Phoenix Blue Ice ». */
export function exactVariation(a: string, b: string): boolean {
  const cw = varWords(a), ew = varWords(b)
  return cw.size === ew.size && [...cw].every(w => ew.has(w))
}

/** Cette carte est-elle EXACTEMENT cette ligne de setlist ? Règles du moteur (année, marque, collection, numéro) + variation identique. */
export function matchesEntryExact(card: MCard, entry: MEntry, set: MSet): boolean {
  const c = candidatesForCard(card, [entry], new Map([[set.id, set]]))
  if (c.length !== 1 || c[0].id !== entry.id) return false
  return exactVariation(card.variation || '', entry.variation || '')
}
