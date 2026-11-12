'use client'
// Tableau de planning des publications par pays : meilleurs créneaux (heure locale puis heure de France à programmer) et bio conseillée.
// Les créneaux sont des repères courants pour TikTok, Reels et Shorts (soir après le travail, midi, début de matinée), pas des garanties :
// le plus fiable reste l'onglet « Statistiques » de ton compte, qui montre quand TES abonnés sont en ligne.
import { useState } from 'react'

interface Row {
  pays: string; fuseau: string
  local: string        // créneaux en heure locale
  france: string       // même créneaux, heure de France (hiver : UTC+1)
  langue: string
  bio: string
}

const ROWS: Row[] = [
  { pays: 'États-Unis', fuseau: 'Côte Est (UTC−5) · Côte Ouest (UTC−8)', local: '12 h–13 h · 19 h–21 h (Est)', france: '18 h–19 h · 1 h–3 h (Est) ; 4 h (Ouest)', langue: 'Anglais',
    bio: 'Free app for card collectors 🏀🎴 Gallery · 3D · Trades 👇' },
  { pays: 'Canada', fuseau: 'Est (UTC−5), comme New York', local: '12 h–13 h · 19 h–21 h', france: '18 h–19 h · 1 h–3 h', langue: 'Anglais (français au Québec)',
    bio: 'L’app gratuite des collectionneurs de cartes 🏀🎴 Galerie · 3D · Échanges 👇' },
  { pays: 'Royaume-Uni', fuseau: 'UTC+0 (1 h de moins qu’en France)', local: '12 h–13 h · 18 h–21 h', france: '13 h–14 h · 19 h–22 h', langue: 'Anglais',
    bio: 'Free app for card collectors 🃏 Gallery, 3D & trades 👇' },
  { pays: 'Allemagne', fuseau: 'UTC+1 (même heure qu’en France)', local: '12 h–13 h · 18 h–21 h', france: '12 h–13 h · 18 h–21 h', langue: 'Allemand',
    bio: 'Kostenlose App für Kartensammler 🏀🎴 Galerie · 3D · Tausch 👇' },
  { pays: 'France', fuseau: 'UTC+1', local: '12 h–13 h 30 · 18 h–21 h 30', france: '12 h–13 h 30 · 18 h–21 h 30', langue: 'Français',
    bio: 'L’app gratuite des collectionneurs de cartes 🏀🎴 Galerie · 3D · Trades 👇' },
  { pays: 'Espagne', fuseau: 'UTC+1 (même heure qu’en France)', local: '14 h–15 h · 21 h–23 h', france: '14 h–15 h · 21 h–23 h', langue: 'Espagnol',
    bio: 'App gratis para coleccionistas de cartas 🏀🎴 Galería · 3D · Trades 👇' },
  { pays: 'Italie', fuseau: 'UTC+1 (même heure qu’en France)', local: '12 h 30–14 h · 20 h–22 h 30', france: '12 h 30–14 h · 20 h–22 h 30', langue: 'Italien',
    bio: 'App gratuita per collezionisti di carte 🏀🎴 Galleria · 3D · Scambi 👇' },
]

export default function PubPlanning() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (pays: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(pays); setTimeout(() => setCopied(c => (c === pays ? null : c)), 1500) } catch { /* presse-papiers refusé : la bio reste sélectionnable */ }
  }
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid rgba(128,128,128,0.35)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px', fontSize: 13, borderBottom: '1px solid rgba(128,128,128,0.2)', verticalAlign: 'top' }
  return (
    <section style={{ width: '100%', maxWidth: 1000, marginTop: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>🗓️ Quand publier, et quelle bio, par pays</h2>
      <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 12px' }}>
        Heures de France en hiver (UTC+1). Les États-Unis et l’Europe ne changent pas d’heure aux mêmes dates : en mars et en novembre, l’écart peut varier d’une heure.
        Ce sont des repères courants, pas des garanties : l’onglet Statistiques de ton compte montre quand tes abonnés sont réellement en ligne, c’est lui qui fait foi.
        Une bio TikTok est limitée à 80 caractères.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr><th style={th}>Pays</th><th style={th}>Créneaux locaux</th><th style={th}>À programmer (France)</th><th style={th}>Langue</th><th style={th}>Bio conseillée</th></tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.pays}>
                <td style={td}><strong>{r.pays}</strong><div style={{ fontSize: 11, opacity: 0.7 }}>{r.fuseau}</div></td>
                <td style={td}>{r.local}</td>
                <td style={{ ...td, fontWeight: 800 }}>{r.france}</td>
                <td style={td}>{r.langue}</td>
                <td style={td}>
                  <div>{r.bio}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <button type="button" onClick={() => copy(r.pays, r.bio)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.5)', background: 'transparent', color: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {copied === r.pays ? 'Copié ✓' : 'Copier'}
                    </button>
                    <span style={{ fontSize: 11, opacity: r.bio.length > 80 ? 1 : 0.6, color: r.bio.length > 80 ? '#c0392b' : 'inherit' }}>{r.bio.length}/80</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
