'use client'
import type { TeamStint } from '@/lib/espnHeadshot'

// "2003-04" / "2009-10" -> "2003–2010" ; une seule saison -> "2023-24".
function yearsLabel(from: string, to: string): string {
  if (from === to) return from
  const start = from.slice(0, 4)
  const endYear = parseInt(to.slice(0, 4), 10) + 1
  return Number.isFinite(endYear) ? `${start}–${endYear}` : `${from} → ${to}`
}

// Parcours du joueur : une pastille par equipe (logo + annees), dans l'ordre.
// La derniere est l'equipe actuelle. `variant="dark"` pour la presentation
// plein ecran (fond sombre).
export default function TeamHistory({ history, variant = 'light' }: { history: TeamStint[]; variant?: 'light' | 'dark' }) {
  if (!history || history.length === 0) return null
  const dark = variant === 'dark'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
      {history.map((s, i) => {
        const current = i === history.length - 1
        const logo = dark ? (s.logoDark || s.logo) : s.logo
        return (
          <div key={`${s.slug}-${s.from}`} title={s.name} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: dark ? '12px 14px' : '8px 10px', minWidth: dark ? 96 : 76,
            borderRadius: 12,
            background: dark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)',
            border: `1px solid ${current ? (dark ? 'rgba(255,255,255,0.35)' : '#003DA6') : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
          }}>
            {logo
              // Image de fond CSS plutot que <img> : un carre plein apparaissait avec <img>
              // (meme probleme que TeamBadge, voir son commentaire LogoBox).
              ? <div role="img" aria-label={s.name} style={{ width: dark ? 48 : 34, height: dark ? 48 : 34, backgroundImage: `url(${logo})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
              : <div style={{ fontWeight: 900, fontSize: 14 }}>{s.abbr}</div>}
            <div style={{ fontSize: dark ? 13 : 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.2, color: dark ? '#fff' : 'inherit' }}>{s.abbr || s.name}</div>
            <div style={{ fontSize: dark ? 12 : 10.5, color: dark ? 'rgba(255,255,255,0.5)' : '#888', whiteSpace: 'nowrap' }}>{yearsLabel(s.from, s.to)}</div>
          </div>
        )
      })}
    </div>
  )
}
