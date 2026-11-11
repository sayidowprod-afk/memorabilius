'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import FeedbackForm from './FeedbackForm'
import FederationLogo from './FederationLogo'

const RED = '#C8102E'
const JOIN: Record<string, string> = { fr: 'Devenir adhérent →', en: 'Become a member →', de: 'Mitglied werden →', es: 'Hazte socio →', it: 'Diventa socio →' }

// Icônes réseaux (inline pour éviter des dépendances)
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1 2h6.9l4.8 6.3L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z" /></svg>
  )
}
function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5a15 15 0 0 1 4.3 2.2 16.8 16.8 0 0 0-14.9 0A15 15 0 0 1 8.9 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.7 8.9-.1 13.2.3 17.5a20 20 0 0 0 6 3l.8-1.2a13 13 0 0 1-2-1l.5-.4a14.3 14.3 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 1l.8 1.2a20 20 0 0 0 6-3c.5-5-.8-9.3-2.6-13.1ZM8.3 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>
  )
}


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
  const social: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white' }
  return (
    <>
    {/* Bandeau rouge Fédération de la Carte (toujours rouge, quel que soit le thème) */}
    <div style={{ marginTop: 40, background: RED, color: 'white' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <FederationLogo variant="footer" height={96} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 16, fontStyle: 'italic' }}>{JOIN[lang] || JOIN.fr}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://x.com/Fededelacarte" target="_blank" rel="noopener noreferrer" aria-label="X" style={social}><XIcon /></a>
            <a href="https://discord.gg/6anaAXA3VK" target="_blank" rel="noopener noreferrer" aria-label="Discord" style={social}><DiscordIcon /></a>
          </div>
        </div>
      </div>
    </div>
    <footer style={{ borderTop: '1px solid #eee', padding: '28px 16px' }}>
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
    </>
  )
}
