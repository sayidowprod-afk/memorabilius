'use client'

type TradeKind = 'galerie' | 'offre' | 'recherche'

const KIND: Record<TradeKind, { emoji: string; label: string; color: string; bg: string }> = {
  galerie:   { emoji: '🏷️', label: 'Vente/Trade', color: '#6a1b9a', bg: '#f3e5f5' },
  offre:     { emoji: '📤', label: 'Offre', color: '#2e7d32', bg: '#e8f5e9' },
  recherche: { emoji: '📥', label: 'Recherche', color: '#1976d2', bg: '#e3f2fd' },
}

export default function TradeTypeBadge({ kind, size = 'sm' }: { kind: TradeKind; size?: 'sm' | 'md' }) {
  const k = KIND[kind]
  const dims = size === 'md' ? 24 : 18
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: dims, height: dims, borderRadius: '50%', background: k.color, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: dims * 0.55, flexShrink: 0,
      }}>{k.emoji}</span>
      <span style={{ fontSize: size === 'md' ? 13 : 12, fontWeight: 900, color: k.color }}>{k.label}</span>
    </span>
  )
}
