'use client'
import { TagPill } from '@/components/CardTags'
import { printRunOf, numTier, numShort, type TagKind, type NumTier } from '@/lib/cardTags'

// Une etiquette RC / AUTO / PATCH / NUM isolee, dans le style "teintees" (voir CardTags.tsx).
// Les helpers de tirage vivent dans src/lib/cardTags.ts ; ils sont re-exportes ici pour les anciens imports.
export { printRunOf, numTier }
export type { NumTier }
export const numLabel = numShort

export default function TagIcon({ kind, h = 22, num, title }: {
  kind: TagKind
  h?: number            // hauteur en px
  num?: string | null   // seulement pour kind="num"
  tier?: NumTier        // ignore : la rarete est deduite du tirage
  title?: string
}) {
  return <TagPill kind={kind} num={num} h={h} title={title} />
}
