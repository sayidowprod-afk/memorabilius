'use client'

// Palette canonique RC/AUTO/PATCH, reprise de GalerieClient (deja la plus
// repandue dans l'app) et desormais partagee partout pour eviter les 3 jeux
// de couleurs differents observes (galerie, TradeModal, messages).
export const TAG_COLORS = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' } as const

export default function CardTagBadges({
  rc, auto, patch, num, size = 'sm', compact = false,
}: {
  rc?: boolean; auto?: boolean; patch?: boolean; num?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  compact?: boolean
}) {
  if (!rc && !auto && !patch && !num) return null
  const dims = {
    xs: { fontSize: 7, padding: '1px 3px' },
    sm: { fontSize: 9, padding: '2px 5px' },
    md: { fontSize: 9, padding: '3px 6px' },
    lg: { fontSize: 10, padding: '3px 8px' },
  }[size]
  const base: React.CSSProperties = { ...dims, fontWeight: 900, borderRadius: 4, color: 'white', lineHeight: 1.4 }
  return (
    <>
      {rc && <span style={{ ...base, background: TAG_COLORS.rc }}>{compact ? 'RC' : 'RC'}</span>}
      {auto && <span style={{ ...base, background: TAG_COLORS.auto }}>{compact ? 'AU' : 'AUTO'}</span>}
      {patch && <span style={{ ...base, background: TAG_COLORS.patch }}>{compact ? 'PA' : 'PATCH'}</span>}
      {num && <span style={{ ...base, background: TAG_COLORS.num }}>{compact ? '#N' : '# NUM'}</span>}
    </>
  )
}
