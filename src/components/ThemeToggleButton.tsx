'use client'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'

export default function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { dark, toggle } = useTheme()
  const { t } = useLang()
  return (
    <button onClick={toggle} aria-label={t('settings_dark_mode')} aria-pressed={dark} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14, ...style }}>
      <span key={dark ? 'sun' : 'moon'} className="theme-icon-spin">{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}
