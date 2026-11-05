'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

// Réglage « Thèmes de saison » (page Paramètres) : activer / désactiver, et aperçu de chaque saison sur la page d'accueil.
// Périodes : All-Star 1–20 février · Playoffs 15 avril–20 juin · Noël 1–26 décembre. Hors période, rien ne change.
export default function SeasonRow({ row, rowLabel, rowSub }: { row: CSSProperties; rowLabel: CSSProperties; rowSub: CSSProperties }) {
  const [off, setOff] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => { try { setOff(localStorage.getItem('mb_season_off') === '1') } catch { /* stockage indisponible */ } }, 0); return () => window.clearTimeout(t) }, [])
  const toggle = (v: boolean) => {
    setOff(!v)
    try { if (v) localStorage.removeItem('mb_season_off'); else localStorage.setItem('mb_season_off', '1') } catch { /* stockage indisponible */ }
    window.location.reload()
  }
  const link: CSSProperties = { fontSize: 12, textDecoration: 'underline', marginRight: 12 }
  return (
    <div style={{ ...row, alignItems: 'flex-start' }}>
      <div>
        <div style={rowLabel}>Thèmes de saison</div>
        <div style={rowSub}>Pendant All-Star, les playoffs et Noël, la couleur du site et un liseré en haut de l’écran changent. Si tu as choisi une couleur, elle reste la tienne.</div>
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2, #888)' }}>Aperçu : </span>
          <a href="/?season=allstar" style={link}>All-Star</a><a href="/?season=playoffs" style={link}>Playoffs</a><a href="/?season=noel" style={link}>Noël</a>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        <input type="checkbox" checked={!off} onChange={e => toggle(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#003DA6' }} /> Activés
      </label>
    </div>
  )
}
