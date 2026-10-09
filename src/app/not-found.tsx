'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export default function NotFound() {
  const { t } = useLang()
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
      <div className="nf-404" aria-hidden><span className="da-display">404</span><div className="not-found-card-float nf-ghost"><b className="da-display">?</b></div></div>
      <h1 className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>404</h1>
      <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 16 }}>{t('not_found_title')}</h2>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 40 }}>{t('not_found_sub')}</p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="btn-main btn-primary">{t('not_found_home')}</Link>
        <Link href="/annuaire" className="btn-main btn-secondary">{t('not_found_directory')}</Link>
      </div>
      <style>{`
        @keyframes notFoundCardFloat {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%      { transform: translateY(-10px) rotate(4deg); }
        }
        .not-found-card-float { display: inline-block; animation: notFoundCardFloat 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .not-found-card-float { animation: none; } }
      `}</style>
    </div>
  )
}
