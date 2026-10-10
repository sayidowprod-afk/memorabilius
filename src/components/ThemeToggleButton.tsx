'use client'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'

// Interrupteur clair / sombre a glissiere carree (la poignee passe d'un cote a l'autre). Le prop `style` n'est plus applique tel quel
// (anciennes pastilles rondes) : seules ses proprietes de mise en page (flex, margin) sont reprises.
export default function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { dark, toggle } = useTheme()
  const { t } = useLang()
  const layout: React.CSSProperties = {}
  if (style?.flex !== undefined) layout.flex = style.flex
  if (style?.margin !== undefined) layout.margin = style.margin
  return (
    <button onClick={toggle} className={`theme-switch${dark ? '' : ' is-light'}`} role="switch" aria-checked={dark} aria-label={t('settings_dark_mode')} style={layout}>
      <span className="theme-switch-thumb" aria-hidden>{dark ? '☾' : '☀'}</span>
    </button>
  )
}
