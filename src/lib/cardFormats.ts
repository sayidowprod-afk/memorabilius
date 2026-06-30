export type CardFormatId = 'standard' | 'horizontal' | 'slab' | 'mini' | 'oversized' | 'square' | 'panorama'

export interface CardFormatDef {
  id: CardFormatId
  label: string
  icon: string
  cropRatio: number
  displayRatio: string
  isSlab: boolean
}

export const CARD_FORMATS: CardFormatDef[] = [
  { id: 'standard',   label: 'Standard',    icon: '🃏', cropRatio: 2.5/3.5, displayRatio: '2.5/3.5', isSlab: false },
  { id: 'horizontal', label: 'Horizontale', icon: '↔️', cropRatio: 3.5/2.5, displayRatio: '3.5/2.5', isSlab: false },
  { id: 'slab',       label: 'Slab',        icon: '🔒', cropRatio: 2.5/3.5, displayRatio: '2.5/3.5', isSlab: true  },
  { id: 'mini',       label: 'Mini',        icon: '🔲', cropRatio: 2.5/3.5, displayRatio: '2.5/3.5', isSlab: false },
  { id: 'oversized',  label: 'Oversized',   icon: '📐', cropRatio: 2.5/3.5, displayRatio: '2.5/3.5', isSlab: false },
  { id: 'square',     label: 'Carré',       icon: '⬛', cropRatio: 1,        displayRatio: '1/1',     isSlab: false },
  { id: 'panorama',   label: 'Panorama',    icon: '🖼️', cropRatio: 4/3,      displayRatio: '4/3',     isSlab: false },
]

export function getFormat(id: string | null | undefined): CardFormatDef {
  return CARD_FORMATS.find(f => f.id === id) ?? CARD_FORMATS[0]
}

export function isHorizontalFormat(format: string | null | undefined, is_horizontal?: boolean): boolean {
  return format === 'horizontal' || (!format && !!is_horizontal)
}

export function cardDisplayRatio(format: string | null | undefined, is_horizontal?: boolean): string {
  if (isHorizontalFormat(format, is_horizontal)) return '3.5/2.5'
  return getFormat(format).displayRatio
}
