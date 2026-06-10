interface Card {
  rc?: boolean
  auto?: boolean
  num?: string | boolean
  patch?: boolean
}

export default function CardTags({ rc, auto, num, patch, size = 'sm' }: Card & { size?: 'sm' | 'md' }) {
  const p = size === 'md' ? '3px 8px' : '3px 6px'
  const fs = size === 'md' ? 10 : 9
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
      {rc && <span style={{ fontSize: fs, fontWeight: 900, padding: p, borderRadius: 4, background: '#e67e22', color: 'white', textTransform: 'uppercase' as const }}>RC</span>}
      {auto && <span style={{ fontSize: fs, fontWeight: 900, padding: p, borderRadius: 4, background: '#2e7d32', color: 'white', textTransform: 'uppercase' as const }}>AUTO</span>}
      {num && <span style={{ fontSize: fs, fontWeight: 900, padding: p, borderRadius: 4, background: '#7b1fa2', color: 'white', textTransform: 'uppercase' as const }}>{typeof num === 'string' ? `/${num}` : 'NUM'}</span>}
      {patch && <span style={{ fontSize: fs, fontWeight: 900, padding: p, borderRadius: 4, background: '#1976d2', color: 'white', textTransform: 'uppercase' as const }}>PATCH</span>}
    </div>
  )
}
