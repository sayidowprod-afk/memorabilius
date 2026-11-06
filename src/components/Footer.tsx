'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import FeedbackForm from './FeedbackForm'

const PRESSKIT_LABEL: Record<string, string> = {
  fr: 'Dossier de presse', en: 'Press kit', de: 'Pressemappe', es: 'Dossier de prensa', it: 'Cartella stampa',
}

const COLS: Record<string, { social: string; legal: string; community: string }> = {
  fr: { social: 'Réseaux sociaux', legal: 'Légal', community: 'Communauté' },
  en: { social: 'Social', legal: 'Legal', community: 'Community' },
  de: { social: 'Soziale Netzwerke', legal: 'Rechtliches', community: 'Community' },
  es: { social: 'Redes sociales', legal: 'Legal', community: 'Comunidad' },
  it: { social: 'Social', legal: 'Legale', community: 'Community' },
}

// Pied de page en trois colonnes (Réseaux sociaux, Légal, Communauté), avec le droit d'auteur et le badge Google Play à gauche ; mise en forme : da.css « 289 ».
export default function Footer() {
  const { dark } = useTheme()
  const { t, lang } = useLang()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const year = new Date().getFullYear()
  const cols = COLS[lang] || COLS.fr
  const linkStyle = { color: '#666', textDecoration: 'none', fontSize: 13, fontWeight: 600 }
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 40, padding: '28px 16px' }}>
      <div className="da-footer-in">
        <div className="da-footer-brand">
          <span style={{ color: '#999', fontSize: 13 }}>© {year} Memorabilius</span>
          <a
            href="https://play.google.com/store/apps/details?id=fr.memorabilius.app&hl=fr"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/google-play-badge.png"
              alt="Disponible sur Google Play"
              height={40}
              style={{ height: 40, width: 'auto', background: 'none', animation: 'none' }}
            />
          </a>
        </div>

        <nav className="da-footer-col" aria-label={cols.social}>
          <h4>{cols.social}</h4>
          <a href="https://x.com/memorabilius" target="_blank" rel="noopener noreferrer" style={linkStyle}>X / Twitter</a>
          <a href="https://www.instagram.com/memorabilius.fr/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Instagram</a>
        </nav>

        <nav className="da-footer-col" aria-label={cols.legal}>
          <h4>{cols.legal}</h4>
          <Link href="/mentions-legales" style={linkStyle}>Mentions légales</Link>
          <Link href="/confidentialite" style={linkStyle}>Confidentialité</Link>
          <Link href="/cgu" style={linkStyle}>CGU</Link>
          <a href={`/api/presskit?lang=${lang}`} download style={linkStyle}>{PRESSKIT_LABEL[lang] || PRESSKIT_LABEL.fr}</a>
        </nav>

        <nav className="da-footer-col" aria-label={cols.community}>
          <h4>{cols.community}</h4>
          <button onClick={() => setFeedbackOpen(true)} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>
            {t('feedback_title')}
          </button>
          <a
            href="https://ko-fi.com/gknnn_cards"
            target="_blank"
            rel="noopener noreferrer"
            className="support-btn"
          >
            🏆 Soutenir le projet
          </a>
        </nav>
      </div>

      {feedbackOpen && createPortal(
        <div onClick={() => setFeedbackOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: dark ? '#eee' : '#111' }}>{t('feedback_title')}</h3>
              <button onClick={() => setFeedbackOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: dark ? '#888' : '#aaa', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <FeedbackForm dark={dark} />
          </div>
        </div>,
        document.body
      )}
    </footer>
  )
}
