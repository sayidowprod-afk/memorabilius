import { supabase } from '@/lib/supabase'
import type { GuideBlock, InsertCard, PyramidRow } from '@/lib/guideBlockTypes'

// Brouillon de guide de collection genere depuis la checklist d'un set (card_sets / card_set_entries, importes de TCDB).
// Reconnait les familles par leurs noms de variation : une variation est un « parallele » (enfant) d'une autre quand son nom commence par
// le nom complet de celle-ci (ex. « Bank Shot Mosaic Gold » est un parallele de « Bank Shot »). Les familles racines sont ensuite classees :
//  - autographes / memorabilia : par le nom ;
//  - paralleles de la carte de base : racines qui couvrent une grande part de la base (>= 15 % du nombre de cartes de base) ;
//  - inserts : le reste.
// Rien d'invente : les visuels, les tirages (/25...) et les odds restent a remplir a la main dans l'editeur.

export interface SetRow { id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }
export interface GeneratedGuide {
  title: string; slug: string; excerpt: string; category: string
  blocks: GuideBlock[]
  stats: { base: number; parallels: number; inserts: number; autos: number; memo: number; photos: number; runs: number }
  warnings: string[]
}

const SPORT_LABEL: Record<string, string> = { nba: 'Basketball', nfl: 'Football', mlb: 'Baseball', nhl: 'Hockey', football: 'Soccer', wnba: 'Basketball', ncaa: 'College Football' }

export function slugify(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const COLORS: [string, string][] = [
  ['neon green', '#39ff14'], ['cherry blossom', '#f9a8d4'], ['gold', '#f5c518'], ['silver', '#c0c0c0'], ['bronze', '#cd7f32'], ['black', '#111111'],
  ['white', '#f2f2f2'], ['blue', '#2563eb'], ['red', '#dc2626'], ['green', '#16a34a'], ['orange', '#f97316'], ['pink', '#ec4899'], ['purple', '#9333ea'],
  ['teal', '#14b8a6'], ['yellow', '#facc15'], ['peacock', '#0e7490'], ['camo', '#556b2f'],
]
function colorsOf(name: string): string[] {
  const out: string[] = []
  let rest = ' ' + name.toLowerCase().replace(/[^a-z ]+/g, ' ') + ' '
  const found: { i: number; c: string }[] = []
  for (const [w, hex] of COLORS) {
    let from = 0
    for (;;) {
      const at = rest.indexOf(' ' + w + ' ', from)
      if (at < 0) break
      found.push({ i: at, c: hex })
      rest = rest.slice(0, at) + ' '.repeat(w.length + 1) + rest.slice(at + w.length + 1) // evite de compter « green » dans « neon green »
      from = at + 1
    }
  }
  found.sort((a, b) => a.i - b.i).forEach(f => { if (!out.includes(f.c)) out.push(f.c) })
  return out
}

// Colorgraphs, Pictographs, Rookie Scripts... sont des autographes malgre l'absence du mot « autograph »
// ── Cartes des galeries (cartes_manuelles) : tirages (/25...) et photos des parallèles / inserts ─────────────────────────────────────
// Le texte des variations saisi par les collectionneurs ne reprend pas exactement celui de la checklist (« Gold », « Gold Mosaic », « Gold Prizm »...) :
// on compare des clés normalisées (mots triés, sans le nom du produit ni les mots parasites).
interface UserCard { variation: string | null; num: string | null; image_recto: string | null }
const NOISE = new Set(['panini', 'prizm', 'basketball', 'football', 'nba', 'parallel', 'the', 'and', 'of', 'card', 'cards'])
function tokensOf(v: string, product: Set<string>): string[] {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .map(w => (w === 'laser' ? 'lazer' : w)).filter(w => w && !NOISE.has(w) && !product.has(w) && !/^\d{4}$/.test(w))
}
const keyOf = (v: string, product: Set<string>) => tokensOf(v, product).sort().join(' ')

async function loadUserCards(set: SetRow, productWords: string[]): Promise<UserCard[]> {
  if (!set.year || !productWords.length) return []
  const rows: (UserCard & { user_id: string; collection: string | null })[] = []
  const pattern = `%${productWords.join('%')}%`
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('cartes_manuelles').select('user_id, collection, variation, num, image_recto')
      .ilike('collection', pattern).ilike('annee', `%${set.year}%`).not('image_recto', 'is', null).order('id').range(from, from + 999)
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000 || rows.length >= 6000) break
  }
  // sport : « Mosaic Football » ne doit pas alimenter le guide d'un set de basket
  const other = /football|baseball|soccer|hockey|wnba/i
  const mine = new RegExp(set.sport === 'nba' ? 'basketball' : set.sport, 'i')
  const kept = rows.filter(c => !(c.collection && other.test(c.collection) && !mine.test(c.collection)))
  // cartes privees exclues : jamais de photo d'une carte que son proprietaire a masquee
  const priv = new Set<string>()
  const users = [...new Set(kept.map(c => c.user_id))]
  for (let i = 0; i < users.length; i += 40) {
    const { data } = await supabase.from('cartes_privees').select('card_key').in('user_id', users.slice(i, i + 40)).limit(5000)
    for (const p of data || []) priv.add(p.card_key)
  }
  return kept.filter(c => c.image_recto && !priv.has(c.image_recto))
}
// tirage le plus frequent parmi des numeros « 038/125 » -> « /125 » (en cas d'egalite, le plus petit)
function printRunOf(cards: UserCard[]): string {
  const cnt = new Map<number, number>()
  for (const c of cards) {
    const m = (c.num || '').match(/\/\s*(\d{1,5})\s*$/)
    if (m && Number(m[1]) > 0) cnt.set(Number(m[1]), (cnt.get(Number(m[1])) || 0) + 1)
  }
  const best = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
  return best ? `/${best[0]}` : ''
}

const isAuto = (n: string) => /auto|signature|signed|graphs?|script/i.test(n)
const isMemo = (n: string) => /jersey|patch|relic|memorabilia|swatch|material|fabric|prime\b|logoman|laundry/i.test(n)

async function entriesOf(setId: number, variation: string) {
  const rows: { card_number: string | null; player_name: string; team: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('card_set_entries').select('card_number, player_name, team').eq('set_id', setId).eq('variation', variation).order('card_number').range(from, from + 999)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

// "1" < "2" < "10" puis les codes alphabetiques (AM-ALL, AM-ALX...)
function cardOrder(a: string, b: string) {
  const na = parseInt(a, 10), nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb) && String(na) === a && String(nb) === b) return na - nb
  return a.localeCompare(b)
}

export async function generateGuideFromSet(setId: number): Promise<GeneratedGuide> {
  const { data: set } = await supabase.from('card_sets').select('id, name, year, brand, sport, total_cards').eq('id', setId).single()
  if (!set) throw new Error('Set introuvable')
  const { data: varData } = await supabase.rpc('get_set_variations', { p_set_id: setId })
  if (!varData?.length) throw new Error('Ce set n’a pas de checklist importée')
  const counts = new Map<string, number>()
  for (const r of varData as { variation: string | null; cnt: number | string }[]) counts.set(r.variation ?? 'Base', Number(r.cnt))
  const base = counts.get('Base') ?? 0
  const names = [...counts.keys()].sort()

  // familles racines : aucune autre variation n'est un prefixe (par mots) de leur nom
  const roots = names.filter(v => !names.some(w => w !== v && v.startsWith(w + ' ')))
  const kids = new Map<string, string[]>()
  for (const r of roots) kids.set(r, names.filter(v => v !== r && v.startsWith(r + ' ')))

  const parallels: string[] = []
  const inserts: string[] = []
  const autos: string[] = []
  const memos: string[] = []
  const baseThreshold = Math.max(40, Math.round(base * 0.15))
  const foreign: string[] = []
  for (const r of roots) {
    if (r === 'Base') continue
    // « 2024-25 Panini Origins Update II: ... » : variations d'un AUTRE produit melangees a la checklist, ignorees
    if (/^\d{4}/.test(r)) { foreign.push(r); continue }
    if (isAuto(r)) autos.push(r)
    else if (isMemo(r)) memos.push(r)
    else if (base > 0 && (counts.get(r) ?? 0) >= baseThreshold) parallels.push(r)
    else inserts.push(r)
  }

  // nom d'affichage des paralleles : on retire le nom du produit (« Mosaic ») quand la majorite des noms le portent en dernier mot
  const lastWords = new Map<string, number>()
  for (const p of parallels) { const w = p.split(' ').slice(-1)[0]; lastWords.set(w, (lastWords.get(w) || 0) + 1) }
  const top = [...lastWords.entries()].sort((a, b) => b[1] - a[1])[0]
  const product = top && top[1] >= parallels.length * 0.5 && set.name.toLowerCase().includes(top[0].toLowerCase()) ? top[0] : ''
  const display = (p: string) => { const t = product && p.endsWith(' ' + product) ? p.slice(0, -(product.length + 1)) : p; return t.trim() || p }

  const warnings: string[] = []

  // mots du produit (« 2024-25 Panini Mosaic » -> mosaic) pour comparer les noms de variation, et cartes des galeries correspondantes
  const productWords: string[] = (set.name as string).replace(/^\d{4}(?:-\d{2,4})?\s+/, '').split(/\s+/).filter((w: string) => w && !/^(panini|topps|upper|deck|leaf)$/i.test(w))
  const prodSet = new Set<string>(productWords.map((w: string) => w.toLowerCase()))
  // le champ « collection » saisi par les collectionneurs peut ne contenir que le dernier mot du produit (« Optic » pour « Donruss Optic »)
  const userCards = await loadUserCards(set, productWords.slice(-1)).catch(() => [] as UserCard[])
  const byKey = new Map<string, UserCard[]>()
  for (const c of userCards) {
    if (!c.variation || !c.variation.trim()) continue
    const k = keyOf(c.variation, prodSet)
    if (!k) continue
    const arr = byKey.get(k) || []
    arr.push(c); byKey.set(k, arr)
  }
  const load = async (list: string[]) => {
    const out = new Map<string, string[]>()
    let i = 0
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (i < list.length) {
        const v = list[i++]
        const rows = await entriesOf(setId, v)
        const lines = rows
          .sort((a, b) => cardOrder(a.card_number || '', b.card_number || ''))
          .map(e => `${e.card_number ? e.card_number + ' ' : ''}${e.player_name}${e.team ? ` (${e.team})` : ''}`)
        out.set(v, lines)
        if (lines.length <= 3) warnings.push(`${v} : seulement ${lines.length} joueur(s) dans la checklist`)
      }
    }))
    return out
  }
  let imagesFound = 0
  const gridsFor = (list: string[], players: Map<string, string[]>): GuideBlock[] =>
    list.map(v => ({
      type: 'insert_grid' as const,
      cards: [(() => { const img = byKey.get(keyOf(v, prodSet))?.[0]?.image_recto || ''; if (img) imagesFound++; return { name: v, image: img, printRun: '' } as InsertCard })()],
      oddsTable: { columns: [], rows: [] },
      players: players.get(v)?.length ? players.get(v)! : ['Coming Soon.'],
    }))
  const [insP, autoP, memoP] = await Promise.all([load(inserts), load(autos), load(memos)])

  let runsFound = 0
  let parallelImages = 0
  const rows: PyramidRow[] = parallels.map(p => {
    const cols = colorsOf(display(p))
    const matches = byKey.get(keyOf(p, prodSet)) || []
    const printRun = printRunOf(matches)
    const image = matches[0]?.image_recto || ''
    if (printRun) runsFound++
    if (image) { parallelImages++; imagesFound++ }
    const row: PyramidRow = { name: display(p), printRun, patternImage: '', cardImage: image }
    if (cols.length === 1) row.patternColor = cols[0]
    else if (cols.length >= 2) row.patternGradient = cols.slice(0, 3)
    return row
  })
  // du plus rare (sommet de la pyramide) au plus courant : tirages croissants, puis les non numerotes par ordre alphabetique
  const runNum = (r: PyramidRow) => (r.printRun ? Number(r.printRun.slice(1)) : Infinity)
  rows.sort((a, b) => runNum(a) - runNum(b) || a.name.localeCompare(b.name))

  const h = (t: string): GuideBlock => ({ type: 'text', html: `<h2 style="text-align: center;">${t}</h2><p></p>` })
  const blocks: GuideBlock[] = []
  if (rows.length) blocks.push(h('PARALLELS'), { type: 'pyramid', rows, layout: 'auto' })
  if (inserts.length) blocks.push(h('INSERTS'), ...gridsFor(inserts, insP))
  if (memos.length) blocks.push(h('MEMORABILIA'), ...gridsFor(memos, memoP))
  if (autos.length) blocks.push(h('AUTOGRAPHS'), ...gridsFor(autos, autoP))
  blocks.push(h('Checklist &amp; Team Sets'), { type: 'setlist_embed', setId })
  for (const b of blocks) (b as { id?: string }).id = Math.random().toString(36).slice(2) + Date.now().toString(36)

  // « 2024-25 Panini Mosaic » -> « Panini Mosaic 2024-25 Basketball Guide and Checklist »
  const m = set.name.match(/^(\d{4}(?:-\d{2,4})?)\s+(.*)$/)
  const label = m ? `${m[2]} ${m[1]}` : set.name
  const sport = SPORT_LABEL[set.sport] || ''
  const title = `${label}${sport ? ' ' + sport : ''} Guide and Checklist`
  const unknown = rows.filter(r => !r.patternColor && !r.patternGradient).length
  if (foreign.length) warnings.push(`${foreign.length} famille(s) d’un autre produit ignorée(s) : ${foreign.join(', ')}`)
  const nIns = inserts.length + autos.length + memos.length
  warnings.push(`Photos trouvées dans les galeries : ${parallelImages}/${rows.length} parallèles, ${imagesFound - parallelImages}/${nIns} inserts et autographes (à compléter à la main pour les autres)`)
  if (rows.length) warnings.push(`Tirages trouvés : ${runsFound}/${rows.length} parallèles (les autres sont à renseigner à la main${unknown ? `, ${unknown} sans couleur reconnue` : ''})`)
  warnings.push('Odds (tableaux de probabilités) à ajouter à la main')

  return {
    title, slug: slugify(label), excerpt: '', category: 'Collection Guide & Checklist', blocks,
    stats: { base, parallels: parallels.length, inserts: inserts.length, autos: autos.length, memo: memos.length, photos: imagesFound, runs: runsFound },
    warnings,
  }
}

// Recopie les photos trouvees (stockage des collectionneurs) dans le stockage des guides : si un collectionneur supprime sa carte, la photo du guide reste.
// Toute image qu'on n'arrive pas a recopier garde son adresse d'origine.
export async function rehostGuideImages(blocks: GuideBlock[], onProgress?: (done: number, total: number) => void): Promise<GuideBlock[]> {
  const urls = new Set<string>()
  const wanted = (u?: string) => !!u && !u.includes('/guide-images/')
  for (const b of blocks) {
    if (b.type === 'pyramid') b.rows.forEach(r => { if (wanted(r.cardImage)) urls.add(r.cardImage) })
    else if (b.type === 'insert_grid') b.cards.forEach(c => { if (wanted(c.image)) urls.add(c.image) })
  }
  const list = [...urls]
  const map = new Map<string, string>()
  let i = 0, done = 0
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < list.length) {
      const url = list[i++]
      try {
        const r = await fetch(url)
        if (r.ok) {
          const blob = await r.blob()
          if (blob.size > 0 && blob.size <= 5 * 1024 * 1024) {
            const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
            const path = `auto/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            const { error } = await supabase.storage.from('guide-images').upload(path, blob, { contentType: blob.type || 'image/jpeg' })
            if (!error) map.set(url, supabase.storage.from('guide-images').getPublicUrl(path).data.publicUrl)
          }
        }
      } catch { /* on garde l'adresse d'origine */ }
      onProgress?.(++done, list.length)
    }
  }))
  const swap = (u: string) => map.get(u) || u
  return blocks.map(b => {
    if (b.type === 'pyramid') return { ...b, rows: b.rows.map(r => ({ ...r, cardImage: swap(r.cardImage) })) }
    if (b.type === 'insert_grid') return { ...b, cards: b.cards.map(c => ({ ...c, image: swap(c.image) })) }
    return b
  })
}
