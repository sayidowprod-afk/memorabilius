'use client'

export default function EmptyState({
  icon, title, subtitle, action, compact = false,
}: {
  icon: string | React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className="es-wrap" style={{ padding: compact ? '34px 20px' : '54px 20px' }}>
      {/* carte fantome : l'icone dans une carte en pointilles, legerement inclinee */}
      <div className="es-ghost" style={{ width: compact ? 72 : 96 }}>
        <span style={{ fontSize: compact ? 30 : 40, lineHeight: 1 }}>{icon}</span>
      </div>
      <p className="es-title da-display" style={{ fontSize: compact ? 24 : 32 }}>{title}</p>
      {subtitle && <p style={{ color: 'var(--text3, #999)', fontSize: 13, margin: '8px auto 0', maxWidth: 360 }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}
