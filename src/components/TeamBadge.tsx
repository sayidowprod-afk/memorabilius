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

  // Un vrai logo d'equipe (ecusson largement rempli, pas une icone fine) ecrase en
  // silhouette monochrome a 28px ne montre quasiment plus aucun detail -- juste une
  // masse sombre, illisible quelle que soit l'equipe. On garde donc les couleurs
  // d'origine (seule facon de rester reconnaissable a cette taille) et on regle le
  // vrai probleme -- le cercle de fond blanc pur qui tranchait sur fond sombre --
  // en l'adoucissant en gris tres clair + fine bordure adaptee au theme.
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
