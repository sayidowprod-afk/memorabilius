'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import FeedbackForm from './FeedbackForm'

export default function Footer() {
  const { dark } = useTheme()
  const { t } = useLang()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const year = new Date().getFullYear()
  const linkStyle = { color: '#666', textDecoration: 'none', fontSize: 13, fontWeight: 600 }
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 40, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#999', fontSize: 13 }}>© {year} Memorabilius</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
          <Link href="/mentions-legales" style={linkStyle}>Mentions légales</Link>
          <Link href="/confidentialite" style={linkStyle}>Confidentialité</Link>
          <Link href="/cgu" style={linkStyle}>CGU</Link>
          <button onClick={() => setFeedbackOpen(true)} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            {t('feedback_title')}
          </button>
          <a
            href="https://ko-fi.com/gknnn_cards"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#003DA6', color: 'white',
              padding: '7px 14px', borderRadius: 20,
              fontSize: 13, fontWeight: 800, textDecoration: 'none',
            }}
          >
            ☕ Soutenir le projet
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
