// Types de blocs riches additionnels d'un guide, stockés dans guides.blocks (JSONB).
// Rendus après le texte Tiptap (guides.content), jamais entremêlés dedans.

export interface PyramidRow {
  name: string
  printRun: string
  image: string
}

export interface InsertCard {
  name: string
  image: string
  printRun?: string
}

export interface OddsRow {
  label: string
  value: string
}

export type GuideBlock =
  | { type: 'pyramid'; title?: string; rows: PyramidRow[] }
  | { type: 'insert_grid'; title?: string; cards: InsertCard[]; oddsRows: OddsRow[] }
  | { type: 'setlist_embed'; setId: number; title?: string }
