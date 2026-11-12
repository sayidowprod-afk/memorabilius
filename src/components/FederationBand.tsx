'use client'
import { useLang } from '@/lib/LangContext'
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


// Bandeau rouge Fédération de la Carte (toujours rouge, quel que soit le thème) : au-dessus du pied de page sur le web, en fin de page dans l'application.
export default function FederationBand({ marginTop = 40, compact = false }: { marginTop?: number; compact?: boolean }) {
  const { lang } = useLang()
  const social: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: compact ? 32 : 38, height: compact ? 32 : 38, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white' }
  return (
    <div style={{ marginTop, background: RED, color: 'white' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: compact ? '14px 16px' : '24px 20px', display: 'flex', flexWrap: compact ? 'nowrap' : 'wrap', gap: compact ? 12 : 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <FederationLogo variant="footer" height={compact ? 50 : 96} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: compact ? 'flex-end' : 'center', gap: compact ? 6 : 10, flexShrink: 0 }}>
          <span style={{ fontWeight: 900, fontSize: compact ? 13 : 16, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{JOIN[lang] || JOIN.fr}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://x.com/Fededelacarte" target="_blank" rel="noopener noreferrer" aria-label="X" style={social}><XIcon /></a>
            <a href="https://discord.gg/6anaAXA3VK" target="_blank" rel="noopener noreferrer" aria-label="Discord" style={social}><DiscordIcon /></a>
          </div>
        </div>
      </div>
    </div>
  )
}
