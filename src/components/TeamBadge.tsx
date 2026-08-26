'use client'
import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

// Logo monochrome maison (PNG transparent, trace en noir uni) -- voir
// public/team-logos-mono/README.md pour le format et la liste des fichiers
// attendus. S'il n'existe pas encore pour une equipe, bascule automatiquement
// sur le logo couleur officiel (onError ci-dessous).
function monoLogoPath(teamId: string): string {
  return `/team-logos-mono/${teamId.replace(':', '-')}.png`
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const { dark } = useTheme()
  const [monoFailed, setMonoFailed] = useState(false)
  const [colorFailed, setColorFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null

  // 1. Logo monochrome maison si dispo -- trace en noir, inverse en blanc en
  // mode sombre. Marche bien car dessine expres en silhouette simple, contrairement
  // aux logos officiels complets qui deviennent illisibles une fois monochromes.
  if (!monoFailed) {
    return (
      <img
        src={monoLogoPath(teamId)}
        alt={team.name}
        title={team.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0, filter: dark ? 'invert(1)' : 'none' }}
        onError={() => setMonoFailed(true)}
      />
    )
  }

  // 2. Fallback : logo couleur officiel dans un cercle de fond neutre (les PNG
  // ESPN ont un fond carre quasi-opaque qu'il faut masquer ; NBA/foot/NHL sont
  // deja transparents mais le cercle ne les gene pas).
  const url = teamLogoUrl(team, dark)
  if (!url || colorFailed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
    )
  }

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
        onError={() => setColorFailed(true)}
      />
    </div>
  )
}
