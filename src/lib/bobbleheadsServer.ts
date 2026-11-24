// Données « en direct » des bobbleheads pour les pages joueurs (serveur uniquement : lit public/bobbleheads/live.json, régénéré toutes les 10 s par scripts/bobble-live.mjs).
// Priorité : les 7 figurines complètes d'origine (corps propre au joueur), puis les têtes validées (OK) posées sur le corps de leur équipe avec leur numéro.
import liveJson from '../../public/bobbleheads/live.json'
import numbersJson from '../../public/bobbleheads/numbers.json'
import mlbLiveJson from '../../public/bobbleheads/mlb/live.json'   // baseball : mêmes données que le basket (scripts/bobble-live.mjs), images dans public/bobbleheads/mlb
import { BOBBLEHEADS, normName, type NumCfg } from '@/lib/bobbleheads'

// Numéro porté le plus longtemps par chaque joueur dans chaque équipe (scripts/bobble-numbers.mjs) : {idJoueur: {ABR: numéro}}
const NUMBERS = numbersJson as unknown as Record<string, Record<string, string>>

export type BobbleFig = {
  id: string
  sport?: 'mlb'   // absent = basket
  head: { w: number; h: number; ear: number; skin?: number[] }
  headSrc: string
  body: { w: number; h: number; span: number; src: string; team?: string; num?: string; numFill?: string; numStroke?: string; numCfg?: NumCfg }
  nums?: Record<string, string>   // numéro porté le plus longtemps dans chaque équipe où le joueur est passé
  extra?: Record<string, { w: number; h: number; span: number; src: string; num: NumCfg }>   // tenues des anciennes équipes (BOB, SEA), proposées à tous
  kits?: string[]   // tenues disponibles de l'équipe ('dom' = domicile, 'ext', 'alt')
  kitMeta?: Record<string, { w: number; h: number; span: number; src: string; num: NumCfg }>   // corps et couleurs du numéro propres à chaque tenue
}

type Live = { extra?: BobbleFig['extra']; players: Record<string, { name: string; team: string; num: string; head: { w: number; h: number; ear: number; skin?: number[] }; v: number }>; teams: Record<string, { w: number; h: number; span: number; num: { fill: string; stroke: string }; kits?: string[]; kitMeta?: BobbleFig['kitMeta'] }> }

// Données importées dans le build (public/bobbleheads/live.json, régénéré par scripts/bobble-live.mjs d'après les têtes validées) : fonctionne en production ; en local, le fichier est rechargé à chaud.
const live = liveJson as unknown as Live
const byName = new Map<string, string>()
for (const [id, p] of Object.entries(live.players)) byName.set(normName(p.name), id)
function loadLive() { return { live, byName } }

// Catalogue de toutes les tenues de toutes les équipes (n'importe quel joueur peut porter n'importe quelle tenue) : clés 'PHI-dom', 'PHI-ext', 'BOB-alt'…
export type KitCatalog = { kits: Record<string, { w: number; h: number; span: number; src: string; num: NumCfg }>; teams: { abbr: string; name: string }[] }
export function kitCatalog(sport: 'nba' | 'mlb' = 'nba'): KitCatalog {
  const kits: KitCatalog['kits'] = {}, teams: KitCatalog['teams'] = []
  const src = sport === 'mlb' ? mlb : live, dir = sport === 'mlb' ? '/bobbleheads/mlb' : '/bobbleheads'   // chaque sport a son propre catalogue : les abréviations (PHI, MIA, ATL…) existent dans les deux
  for (const [ab, t] of Object.entries(src.teams) as [string, any][]) {
    kits[`${ab}-dom`] = { w: t.w, h: t.h, span: t.span, src: `${dir}/team-${ab}.webp?v=${t.v || 1}`, num: t.num }
    for (const [k, m] of Object.entries(t.kitMeta || {})) kits[`${ab}-${k}`] = m as KitCatalog['kits'][string]
    teams.push({ abbr: ab, name: t.name || ab })
  }
  teams.sort((a, b) => a.name.localeCompare(b.name))
  return { kits, teams }
}

export function teamBody(abbr: string, num?: string | null): BobbleFig['body'] | null {
  const c = loadLive(); const t = c?.live.teams[abbr]; if (!t) return null
  return { w: t.w, h: t.h, span: t.span, src: `/bobbleheads/team-${abbr}.webp?v=${(t as any).v || 1}`, team: abbr, num: num || undefined, numFill: t.num.fill, numStroke: t.num.stroke, numCfg: t.num as NumCfg }
}

// Même personne, deux fiches sur le site (nom avec ou sans suffixe) : la figurine validée de l'une sert aussi à l'autre
const ALIASES: Record<string, string> = {}
for (const [from, to] of [['Jimmy Butler', 'Jimmy Butler III']]) ALIASES[normName(from)] = normName(to)

// Baseball : toutes les têtes faites (public/bobbleheads/mlb/live.json), posées sur le corps de leur équipe. Même structure que le basket.
const mlb = mlbLiveJson as unknown as Live
const mlbByName = new Map<string, string>()
for (const [id, p] of Object.entries(mlb.players)) mlbByName.set(normName(p.name), id)

export function bobbleFor(playerName: string): BobbleFig | null {
  const n0 = normName(playerName), n = ALIASES[n0] ?? n0
  // 1) tête validée + corps d'équipe + numéro (même maillot pour tous les joueurs d'une équipe)
  const c = loadLive()
  const id = c?.byName.get(n)
  if (c && id) {
    const p = c.live.players[id], t = c.live.teams[p.team]
    if (t) return { id, head: p.head, headSrc: `/bobbleheads/${id}-head.webp?v=${p.v}`, body: { w: t.w, h: t.h, span: t.span, src: `/bobbleheads/team-${p.team}.webp?v=${(t as any).v || 1}`, team: p.team, num: p.num, numFill: t.num.fill, numStroke: t.num.stroke, numCfg: t.num as NumCfg }, kits: t.kits || ['dom'], ...(t.kitMeta ? { kitMeta: t.kitMeta } : {}), ...(NUMBERS[id] ? { nums: NUMBERS[id] } : {}) }
  }
  // 1 bis) baseball : même chose avec les images du dossier mlb
  const mid = mlbByName.get(n)
  if (mid) {
    const p = mlb.players[mid], t = mlb.teams[p.team]
    if (t) return { id: mid, sport: 'mlb', head: p.head, headSrc: `/bobbleheads/mlb/${mid}-head.webp?v=${p.v}`, body: { w: t.w, h: t.h, span: t.span, src: `/bobbleheads/mlb/team-${p.team}.webp?v=${(t as any).v || 1}`, team: p.team, num: p.num, numFill: t.num.fill, numStroke: t.num.stroke, numCfg: t.num as NumCfg }, kits: t.kits || ['dom'], ...(t.kitMeta ? { kitMeta: t.kitMeta } : {}) }
  }
  // 2) secours : figurines complètes d'origine (corps propre au joueur), si le joueur n'est pas dans la liste validée
  for (const [bid, m] of Object.entries(BOBBLEHEADS)) {
    if (m.names.some(x => normName(x) === n)) return { id: bid, head: m.head, headSrc: `/bobbleheads/${bid}-head.webp`, body: { ...m.body, src: `/bobbleheads/${bid}-body.webp` } }
  }
  return null
}
