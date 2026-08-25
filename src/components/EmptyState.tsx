'use client'

export default function EmptyState({
  icon, title, subtitle, action, compact = false,
}: {
  icon: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div style={{
      background: 'var(--card-bg, #fff)', borderRadius: 16,
      padding: compact ? '40px 20px' : '60px 20px', textAlign: 'center',
      boxShadow: compact ? 'none' : 'var(--elevation-sm, 0 4px 20px rgba(0,0,0,0.06))',
    }}>
      <div style={{ fontSize: compact ? 36 : 48, marginBottom: 14 }}>{icon}</div>
      <p style={{ color: 'var(--text2, #666)', fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ color: 'var(--text3, #999)', fontSize: 13, marginTop: 6 }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
