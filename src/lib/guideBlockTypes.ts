// Types de blocs d'un guide, stockés dans guides.blocks (JSONB) - séquence unique et
// ordonnée, mélangeant librement texte, images et blocs riches (l'admin choisit
// l'ordre). La colonne guides.content (ancien blob HTML unique, pré-blocs) n'est
// plus utilisée pour l'écriture ; normalizeGuideBlocks() la lit encore une fois pour
// migrer les guides déjà enregistrés avant l'introduction des blocs texte/image.

export type PatternBlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface PyramidRow {
  name: string
  printRun: string
  patternImage: string // texture/motif de fond de la barre (ex: refractor, wave...)
  // Teinte optionnelle appliquée par-dessus patternImage via background-blend-mode
  // (façon calque Photoshop) - permet de réutiliser UNE texture de base blanche/grise
  // pour toutes les couleurs d'une même variation (wave gold, wave silver, wave red...)
  // au lieu d'uploader une image par couleur. Si absent, patternImage s'affiche telle
  // quelle (comportement d'origine, rétro-compatible).
  patternColor?: string
  patternBlendMode?: PatternBlendMode
  patternOpacity?: number // 0-100, opacité du calque de teinte (défaut 100 si patternColor défini)
  cardImage: string // exemple de carte révélé au survol/tap
}

export interface InsertCard {
  name: string
  image: string
  printRun?: string
}

// Tableau d'odds à plusieurs colonnes (ex: Holo / Platinum) x lignes (ex: Hobby,
// Jumbo, Value, Hanger, Fanatics) - une cellule par [row][column], façon tableau
// d'odds officiel des fabricants (voir capture de référence fournie).
export interface OddsTable {
  columns: string[]
  rows: { label: string; values: string[] }[]
}

export type GuideBlock =
  | { type: 'text'; html: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'text_image'; html: string; image: string; imagePosition: 'left' | 'right' }
  | { type: 'pyramid'; title?: string; rows: PyramidRow[] }
  | { type: 'insert_grid'; title?: string; cards: InsertCard[]; oddsTable: OddsTable; players: string[]; width?: 'full' | 'half' | 'third' }
  | { type: 'setlist_embed'; setId: number; title?: string }

// Défend contre les guides déjà enregistrés avec l'ancienne forme du bloc
// insert_grid (oddsRows: {label,value}[] au lieu de oddsTable, pas de players) -
// convertit à la volée plutôt que de planter au chargement. Migre aussi l'ancien
// champ guides.content (unique blob HTML rendu avant tous les blocs) en le
// préfixant comme premier bloc `text`, sauf si un bloc `text` existe déjà en tête
// (déjà migré lors d'un enregistrement précédent).
export function normalizeGuideBlocks(raw: unknown, legacyContent?: string | null): GuideBlock[] {
  const blocks: GuideBlock[] = !Array.isArray(raw) ? [] : raw.map((b: any) => {
    if (b?.type === 'insert_grid') {
      const oddsTable: OddsTable = b.oddsTable && Array.isArray(b.oddsTable.columns) && Array.isArray(b.oddsTable.rows)
        ? b.oddsTable
        : Array.isArray(b.oddsRows) && b.oddsRows.length > 0
          ? { columns: ['Valeur'], rows: b.oddsRows.map((r: any) => ({ label: r.label || '', values: [r.value || ''] })) }
          : { columns: [], rows: [] }
      return { type: 'insert_grid', title: b.title, cards: Array.isArray(b.cards) ? b.cards : [], oddsTable, players: Array.isArray(b.players) ? b.players : [] }
    }
    return b
  })

  if (legacyContent && legacyContent.trim() && blocks[0]?.type !== 'text') {
    blocks.unshift({ type: 'text', html: legacyContent })
  }

  return blocks
}
