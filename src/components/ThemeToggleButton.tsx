'use client'
import { useTheme } from '@/lib/ThemeContext'

export default function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { dark, toggle } = useTheme()
  return (
    <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14, ...style }}>
      <span key={dark ? 'sun' : 'moon'} className="theme-icon-spin">{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}
