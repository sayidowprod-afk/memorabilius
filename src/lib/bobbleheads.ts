// Bobbleheads des joueurs (têtes et corps détourés, générés en local avec Z-Image Turbo puis détourés avec rembg).
// Les dimensions sont celles des images d'origine : elles servent à les afficher à la même échelle (oreille à oreille pour la tête, épaules pour le corps)
// et à la même hauteur totale. Images optimisées dans public/bobbleheads/<id>-head.webp et <id>-body.webp.

export type BobbleMeta = { names: string[]; head: { w: number; h: number; ear: number }; body: { w: number; h: number; span: number } }

export const BOBBLEHEADS: Record<string, BobbleMeta> = {
  dirk: { names: ["dirk nowitzki"], head: { w: 679, h: 893, ear: 676 }, body: { w: 637, h: 818, span: 429 } },
  duncan: { names: ["tim duncan"], head: { w: 717, h: 879, ear: 714 }, body: { w: 619, h: 771, span: 436 } },
  iverson: { names: ["allen iverson"], head: { w: 745, h: 917, ear: 742 }, body: { w: 656, h: 771, span: 458 } },
  jordan: { names: ["michael jordan"], head: { w: 688, h: 903, ear: 686 }, body: { w: 684, h: 819, span: 469 } },
  kobe: { names: ["kobe bryant"], head: { w: 713, h: 880, ear: 710 }, body: { w: 686, h: 833, span: 480 } },
  lebron: { names: ["lebron james"], head: { w: 621, h: 809, ear: 618 }, body: { w: 674, h: 807, span: 447 } },
  shaq: { names: ["shaquille oneal","shaquille o neal","shaq"], head: { w: 744, h: 937, ear: 740 }, body: { w: 683, h: 788, span: 475 } },
}

export const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Identifiant du bobblehead d'un joueur d'après son nom (ou null s'il n'en a pas encore : la page garde alors sa photo).
export function bobbleIdFor(playerName: string): string | null {
  const n = normName(playerName)
  for (const [id, m] of Object.entries(BOBBLEHEADS)) if (m.names.some(x => normName(x) === n)) return id
  return null
}

// Tenues d'équipe : 'dom' (domicile, par défaut), 'ext' (extérieur), 'alt' (alternative). Le corps d'une tenue est team-<ABBR>-<tenue>.webp, mêmes dimensions que le domicile.
export const KIT_LABEL: Record<string, string> = { dom: 'Domicile', ext: 'Extérieur', alt: 'Alternative', leg: 'Légendaire' }
export const OLD_TEAMS: Record<string, string> = { BOB: 'Charlotte Bobcats', SEA: 'Seattle SuperSonics' }
export type NumCfg = { fill: string; stroke: string; y?: number; size?: number; x?: number; sw?: number; font?: string; fontFamily?: string; fontFile?: string; fontW?: string; hide?: boolean; logo?: { file: string; x: number; y: number; w: number } }
type KitMeta = { w: number; h: number; span: number; src: string; num: NumCfg }
// kit = 'ext' | 'alt' | 'leg' (tenues de l'équipe du joueur) ou 'BOB-ext', 'SEA-dom'… (anciennes équipes, proposées à tous)
export function withKit<T extends { body: { w: number; h: number; span: number; src: string; team?: string; num?: string; numFill?: string; numStroke?: string; numCfg?: NumCfg }; kits?: string[]; kitMeta?: Record<string, KitMeta>; extra?: Record<string, KitMeta>; nums?: Record<string, string> }>(fig: T, kit?: string | null): T {
  const m = kit && kit !== 'dom' ? (kit.includes('-') ? fig.extra?.[kit] : fig.kitMeta?.[kit]) : undefined   // extra = catalogue des tenues de toutes les équipes (useKitCatalog)
  if (!m || !fig.body.team) return fig
  // équipe choisie différente de celle du joueur (ex. 'PHI-dom') : on affiche le numéro qu'il y a porté le plus longtemps ; équipe inconnue pour ce joueur : pas de numéro
  const ab = kit && kit.includes('-') ? kit.split('-')[0] : null
  const num = ab && ab !== fig.body.team ? fig.nums?.[ab] : fig.body.num
  return { ...fig, body: { ...fig.body, w: m.w, h: m.h, span: m.span, src: m.src, numFill: m.num.fill, numStroke: m.num.stroke, numCfg: m.num, num } }
}
