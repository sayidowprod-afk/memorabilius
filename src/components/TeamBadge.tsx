'use client'
import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const { dark } = useTheme()
  const [failed, setFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null
  const url = teamLogoUrl(team, dark)

  if (!url || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
    )
  }

  // NBA (cdn.nba.com) et foot (football-data.org) sont de vraies silhouettes SVG a
  // fond transparent -- on peut les passer en monochrome (blanc/noir selon le theme)
  // sans les casser. NHL (assets.nhle.com) a deja ses propres variantes officielles
  // "light"/"dark" en couleur, pas besoin d'un filtre par-dessus.
  const canMonochrome = team.sport === 'nba' || team.sport === 'football'
  const isTransparentSource = canMonochrome || team.sport === 'nhl'

  if (isTransparentSource) {
    return (
      <img
        src={url}
        alt={team.name}
        title={team.name}
        width={size}
        height={size}
        style={{
          objectFit: 'contain', display: 'block', flexShrink: 0,
          filter: canMonochrome ? (dark ? 'brightness(0) invert(1)' : 'brightness(0)') : undefined,
        }}
        onError={() => setFailed(true)}
      />
    )
  }

  // WNBA / NFL / MLB (ESPN CDN) : le PNG a un fond carre quasi-opaque, pas une
  // silhouette -- un filtre monochrome donnerait juste un carre plein. On garde un
  // cercle de fond clair (necessaire pour masquer les coins du carre source) mais
  // adouci en gris tres clair + fine bordure au lieu du blanc pur qui faisait un
  // halo trop dur sur fond sombre.
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#f2f2f2',
      border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <img
        src={url}
        alt={team.name}
        title={team.name}
        width={Math.round(size * 0.8)}
        height={Math.round(size * 0.8)}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
