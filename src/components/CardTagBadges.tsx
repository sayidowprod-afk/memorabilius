'use client'
import TagIcon from '@/components/TagIcon'

// Palette canonique RC/AUTO/PATCH/NUM, encore utilisee par des filtres et des
// compteurs (les pastilles de carte, elles, sont maintenant des icones : TagIcon).
export const TAG_COLORS = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' } as const

const HEIGHT = { xs: 22, sm: 26, md: 30, lg: 34 } as const

export default function CardTagBadges({
  rc, auto, patch, num, numText, size = 'sm',
}: {
  rc?: boolean; auto?: boolean; patch?: boolean; num?: boolean | string | null
  numText?: string | null   // ex: "038/149" -> l'icone NUM affiche "/149"
  size?: 'xs' | 'sm' | 'md' | 'lg'
  compact?: boolean
}) {
  if (!rc && !auto && !patch && !num) return null
  const h = HEIGHT[size]
  return (
    <>
      {rc && <TagIcon kind="rc" h={h} />}
      {auto && <TagIcon kind="auto" h={h} />}
      {patch && <TagIcon kind="patch" h={h} />}
      {num && <TagIcon kind="num" h={h} num={typeof num === 'string' ? num : numText} />}
    </>
  )
}
