'use client'
import CardTags, { type TagSize } from '@/components/CardTags'
import { TAG_BASE } from '@/lib/cardTags'

// Palette canonique RC/AUTO/PATCH/NUM, encore utilisee par des filtres et des compteurs.
export const TAG_COLORS = TAG_BASE

// Les etiquettes d'une carte (style "teintees"), sur une seule ligne, toujours en entier.
export default function CardTagBadges({
  rc, auto, patch, num, numText, size = 'sm',
}: {
  rc?: boolean; auto?: boolean; patch?: boolean; num?: boolean | string | null
  numText?: string | null   // ex: "038/125" -> affiche "/125", numero complet au survol
  size?: TagSize
  compact?: boolean
}) {
  return <CardTags rc={rc} auto={auto} patch={patch} num={num} numText={numText} size={size} />
}
