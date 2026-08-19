// Types de blocs riches additionnels d'un guide, stockés dans guides.blocks (JSONB).
// Rendus après le texte Tiptap (guides.content), jamais entremêlés dedans.

export interface PyramidRow {
  name: string
  printRun: string
  patternImage: string // texture/motif de fond de la barre (ex: refractor, wave...)
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
  | { type: 'pyramid'; title?: string; rows: PyramidRow[] }
  | { type: 'insert_grid'; title?: string; cards: InsertCard[]; oddsTable: OddsTable; players: string[] }
  | { type: 'setlist_embed'; setId: number; title?: string }

// Défend contre les guides déjà enregistrés avec l'ancienne forme du bloc
// insert_grid (oddsRows: {label,value}[] au lieu de oddsTable, pas de players) -
// convertit à la volée plutôt que de planter au chargement.
export function normalizeGuideBlocks(raw: unknown): GuideBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map((b: any) => {
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
}
