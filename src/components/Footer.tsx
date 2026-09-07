'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import FeedbackForm from './FeedbackForm'
import FederationLogo from './FederationLogo'

const RED = '#C8102E'

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

export default function Footer() {
  const { dark } = useTheme()
  const { t } = useLang()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const year = new Date().getFullYear()
  // Footer toujours rouge (identité Fédération), independant du theme clair/sombre du site.
  const legalLink: React.CSSProperties = { color: 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }
  const social: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white' }

  return (
    <footer style={{ marginTop: 40, background: RED, color: 'white' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '30px 20px 22px', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>

        {/* ── Marque : emblème + texte, recadré en CSS (image intacte) ── */}
        <FederationLogo variant="footer" height={110} />

        {/* ── Avantages adhérents ── */}
        <div style={{ marginLeft: 30 }}>
          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: '0.06em', marginBottom: 8, opacity: 0.95 }}>
            FONCTIONNALITÉS POUR LES ADHÉRENTS :
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, fontWeight: 600, lineHeight: 1.7 }}>
            <li>Badge de Membre</li>
            <li>Personnalisation complète de la galerie</li>
            <li>Export CSV/Sheets/PDF/Scans</li>
            <li>Concours Spéciaux</li>
          </ul>
        </div>

        {/* ── Devenir adhérent ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ fontWeight: 900, fontSize: 16, fontStyle: 'italic' }}>Devenir adhérent →</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://x.com/Fededelacarte" target="_blank" rel="noopener noreferrer" aria-label="X" style={social}><XIcon /></a>
            <a href="https://discord.gg/6anaAXA3VK" target="_blank" rel="noopener noreferrer" aria-label="Discord" style={social}><DiscordIcon /></a>
          </div>
        </div>
      </div>

      {/* ── Barre légale ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>© {year} Memorabilius</span>
            {/* Image de fond CSS sur un div, pas une balise <img> -- meme fix que
                TeamBadge/LogoBox : un <img> fait systematiquement apparaitre son
                fond (ici le lisere gris integre au PNG) quel que soit le filtre
                applique, alors qu'un div en background-image n'a jamais ce souci. */}
            <a
              href="https://play.google.com/store/apps/details?id=fr.memorabilius.app&hl=fr"
              target="_blank"
              rel="noopener noreferrer"
              role="img"
              aria-label="Disponible sur Google Play"
              style={{
                display: 'inline-block', width: 72, height: 28, flexShrink: 0,
                backgroundImage: 'url(/google-play-badge.png)',
                backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
              }}
            />
          </div>
          {/* div (pas <nav>) : globals.css force un fond blanc !important sur tous les <nav> */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <Link href="/mentions-legales" style={legalLink}>Mentions légales</Link>
            <Link href="/confidentialite" style={legalLink}>Confidentialité</Link>
            <Link href="/cgu" style={legalLink}>CGU</Link>
            <button onClick={() => setFeedbackOpen(true)} style={{ ...legalLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              {t('feedback_title')}
            </button>
            <a href="https://ko-fi.com/gknnn_cards" target="_blank" rel="noopener noreferrer"
              style={{ ...legalLink, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
              ☕ Soutenir le projet
            </a>
          </div>
        </div>
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
