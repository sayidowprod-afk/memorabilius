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
  // Dégradé personnalisé (2+ couleurs) appliqué à la place de patternColor quand
  // renseigné — nombre de points libre (ex: rainbow à 3+ couleurs). patternColor
  // reste géré séparément pour la teinte unie (rétro-compat des lignes existantes).
  patternGradient?: string[]
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

// `id` est un identifiant client stable (généré à la création du bloc, préservé à
// travers toutes les modifications puisque chaque éditeur de bloc met à jour via
// `{ ...block, champ }`) — sert de clé React dans GuideBlocksEditor.tsx. Sans lui,
// la clé retombait sur l'index dans le tableau, et React réutilisait l'instance
// (donc l'éditeur Tiptap, qui ne se resynchronise pas tout seul si son contenu
// change sans remonter) d'un autre bloc après un déplacement/suppression/ajout —
// symptômes : un bloc de texte affichait le contenu d'un ancien voisin ("ne se
// met pas à jour"), et supprimer un bloc en supprimait visuellement un autre.
// Optionnel dans le type car les guides déjà enregistrés n'en ont pas —
// normalizeGuideBlocks() en assigne un à la volée pour ceux-là.
export type GuideBlock = { id?: string } & (
  | { type: 'text'; html: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'text_image'; html: string; image: string; imagePosition: 'left' | 'right' }
  // layout : force le style d'affichage de la pyramide au lieu du choix automatique
  // (auto = colonne unique si <= 6 lignes, sinon 2 colonnes gauche/droite alternées) :
  //  - 'single'  : une seule colonne centrée, une barre pleine largeur par ligne.
  //  - 'split'   : 2 colonnes ancrées aux bords, lignes alternées gauche/droite.
  //  - 'joined'  : une seule colonne (comme 'single'), mais chaque barre est coupée
  //                en 2 moitiés symétriques qui se rejoignent au centre (comme le
  //                sommet partagé entre variations ex-aequo), au lieu d'alterner.
  | { type: 'pyramid'; title?: string; rows: PyramidRow[]; layout?: 'auto' | 'single' | 'split' | 'joined' }
  | { type: 'insert_grid'; title?: string; cards: InsertCard[]; oddsTable: OddsTable; players: string[]; width?: 'full' | 'half' | 'third' }
  | { type: 'setlist_embed'; setId: number; title?: string }
)

// Défend contre les guides déjà enregistrés avec l'ancienne forme du bloc
// insert_grid (oddsRows: {label,value}[] au lieu de oddsTable, pas de players) -
// convertit à la volée plutôt que de planter au chargement. Migre aussi l'ancien
// champ guides.content (unique blob HTML rendu avant tous les blocs) en le
// préfixant comme premier bloc `text`, sauf si un bloc `text` existe déjà en tête
// (déjà migré lors d'un enregistrement précédent).
function randomBlockId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function normalizeGuideBlocks(raw: unknown, legacyContent?: string | null): GuideBlock[] {
  const blocks: GuideBlock[] = !Array.isArray(raw) ? [] : raw.map((b: any) => {
    if (b?.type === 'insert_grid') {
      const oddsTable: OddsTable = b.oddsTable && Array.isArray(b.oddsTable.columns) && Array.isArray(b.oddsTable.rows)
        ? b.oddsTable
        : Array.isArray(b.oddsRows) && b.oddsRows.length > 0
          ? { columns: ['Valeur'], rows: b.oddsRows.map((r: any) => ({ label: r.label || '', values: [r.value || ''] })) }
          : { columns: [], rows: [] }
      return { id: b.id, type: 'insert_grid', title: b.title, cards: Array.isArray(b.cards) ? b.cards : [], oddsTable, players: Array.isArray(b.players) ? b.players : [] }
    }
    return b
  })

  if (legacyContent && legacyContent.trim() && blocks[0]?.type !== 'text') {
    blocks.unshift({ type: 'text', html: legacyContent })
  }

  for (const b of blocks) if (!b.id) b.id = randomBlockId()

  return blocks
}
