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
  stats: { base: number; parallels: number; inserts: number; autos: number; memo: number }
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
  const gridsFor = (list: string[], players: Map<string, string[]>): GuideBlock[] =>
    list.map(v => ({
      type: 'insert_grid' as const,
      cards: [{ name: v, image: '', printRun: '' } as InsertCard],
      oddsTable: { columns: [], rows: [] },
      players: players.get(v)?.length ? players.get(v)! : ['Coming Soon.'],
    }))
  const [insP, autoP, memoP] = await Promise.all([load(inserts), load(autos), load(memos)])

  const rows: PyramidRow[] = [...parallels].sort((a, b) => display(a).localeCompare(display(b))).map(p => {
    const cols = colorsOf(display(p))
    const row: PyramidRow = { name: display(p), printRun: '', patternImage: '', cardImage: '' }
    if (cols.length === 1) row.patternColor = cols[0]
    else if (cols.length >= 2) row.patternGradient = cols.slice(0, 3)
    return row
  })

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
  if (rows.length) warnings.push(`Parallèles : tirages (/25, /10…) et ordre de rareté à renseigner à la main${unknown ? `, ${unknown} sans couleur reconnue` : ''}`)
  warnings.push('Odds (tableaux de probabilités) et visuels à ajouter à la main')

  return {
    title, slug: slugify(label), excerpt: '', category: 'Collection Guide & Checklist', blocks,
    stats: { base, parallels: parallels.length, inserts: inserts.length, autos: autos.length, memo: memos.length },
    warnings,
  }
}
