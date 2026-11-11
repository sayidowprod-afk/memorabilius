'use client'
import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import ThemeToggleButton from '@/components/ThemeToggleButton'
import { ACCENTS, getAccent, applyAccent } from '@/lib/accent'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useCollectionFocus, rememberCollectionFocus, type CollectionFocus } from '@/lib/useCollectionFocus'
import { tcgLabel } from '@/lib/tcgGames'

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

// Je collectionne : Sport / TCG / Les deux (visible une fois connecté)
function FocusRow() {
  const { user } = useAuth()
  const { lang } = useLang()
  const focus = useCollectionFocus()
  if (!user) return null
  const pick = async (f: CollectionFocus) => {
    rememberCollectionFocus(user.id, f)
    await supabase.from('profiles').update({ collection_focus: f }).eq('id', user.id)
  }
  const opts: [CollectionFocus, string][] = [['sport', '🏀 ' + tcgLabel('sport', lang)], ['tcg', '🎴 ' + tcgLabel('tcg', lang)], ['both', tcgLabel('both', lang)]]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={tcgLabel('focus', lang)}>
      {opts.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={focus === id} onClick={() => pick(id)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '2px solid ' + (focus === id ? 'var(--accent, #003DA6)' : 'rgba(128,128,128,0.4)'), background: focus === id ? 'var(--accent, #003DA6)' : 'transparent', color: focus === id ? '#fff' : 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{label}</button>
      ))}
    </div>
  )
}

// Titre + boutons, masqués si non connecté
function FocusLabelled() {
  const { user } = useAuth()
  const { lang } = useLang()
  if (!user) return null
  return <div className="sm-r"><label>{tcgLabel('focus', lang)}</label><FocusRow /></div>
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
          <div className="sm-r"><label>Couleur du site</label><AccentRow /></div>
          <FocusLabelled />
        </div>
      )}
    </div>
  )
}

// Version « a plat » pour le menu mobile : drapeaux pleine largeur puis interrupteur (pas de panneau flottant)
// Rangée de pastilles : couleur d'accent du site (garde sur l'appareil)
export function AccentRow() {
  const [cur, setCur] = useState<string | null>(null)
  useEffect(() => { const t = window.setTimeout(() => setCur(getAccent()), 0); return () => window.clearTimeout(t) }, [])
  return (
    <div className="sm-accents" role="radiogroup" aria-label="Couleur du site">
      {ACCENTS.map(a => (
        <button key={a.id} type="button" role="radio" aria-checked={cur === a.color} aria-label={a.label} title={a.label}
          className={'sm-accent' + (cur === a.color ? ' on' : '')} style={{ background: a.color ?? '#003da6' }}
          onClick={() => { setCur(a.color); applyAccent(a.color) }} />
      ))}
    </div>
  )
}

export function SettingsInline() {
  const { t } = useLang()
  return (
    <div className="sm-inline">
      <label>{t('settings_language')}</label>
      <FlagRow />
      <div className="sm-inline-row"><label>{t('settings_dark_mode')}</label><ThemeToggleButton /></div>
      <label>Couleur du site</label>
      <AccentRow />
      <FocusLabelled />
    </div>
  )
}
