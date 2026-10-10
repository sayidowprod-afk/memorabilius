'use client'
import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import ThemeToggleButton from '@/components/ThemeToggleButton'

// Langues proposees (drapeaux dessines en CSS : les emojis de drapeaux ne s'affichent pas sous Windows)
export const LANG_LIST = [
  { code: 'fr' as const, label: 'Français' },
  { code: 'en' as const, label: 'English' },
  { code: 'de' as const, label: 'Deutsch' },
  { code: 'es' as const, label: 'Español' },
  { code: 'it' as const, label: 'Italiano' },
]

function FlagRow({ onPick }: { onPick?: () => void }) {
  const { lang, setLang } = useLang()
  return (
    <div className="sm-flags" role="group" aria-label="Langue">
      {LANG_LIST.map(l => (
        <button key={l.code} type="button" className={'sm-flag' + (lang === l.code ? ' on' : '')} aria-pressed={lang === l.code} aria-label={l.label} title={l.label}
          onClick={() => { setLang(l.code); onPick?.() }}>
          <i className={`sm-fl f-${l.code}`} />
          <span>{l.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  )
}

// Un seul carré « ⚙ » dans la barre du haut : il ouvre un panneau avec la langue (drapeaux) et le mode sombre.
export default function SettingsMenu() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return }
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  return (
    <div ref={ref} className="sm-wrap">
      <button type="button" className={'sm-btn' + (open ? ' on' : '')} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={t('settings_title')} title={t('settings_title')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="sm-panel" role="dialog" aria-label={t('settings_title')}>
          <span className="sm-t">{t('settings_title')}</span>
          <div className="sm-r"><label>{t('settings_language')}</label><FlagRow onPick={() => setOpen(false)} /></div>
          <div className="sm-r sm-r-row"><label>{t('settings_dark_mode')}</label><ThemeToggleButton /></div>
        </div>
      )}
    </div>
  )
}

// Version « a plat » pour le menu mobile : drapeaux pleine largeur puis interrupteur (pas de panneau flottant)
export function SettingsInline() {
  const { t } = useLang()
  return (
    <div className="sm-inline">
      <label>{t('settings_language')}</label>
      <FlagRow />
      <div className="sm-inline-row"><label>{t('settings_dark_mode')}</label><ThemeToggleButton /></div>
    </div>
  )
}
