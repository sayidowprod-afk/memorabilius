'use client'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const team = getTeamById(teamId)
  if (!team) return null
  const url = teamLogoUrl(team)

  if (!url) {
    // Pas de logo (foot sans fdo, ou sport inconnu) → cercle coloré sans texte
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: team.color, flexShrink: 0,
      }} />
    )
  }

  // Cercle blanc qui contient le logo — élimine le fond rectangulaire quelle que soit la source
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
      boxShadow: '0 0 0 0.75px rgba(0,0,0,0.10)',
    }}>
      <img
        src={url}
        alt={team.name}
        title={team.name}
        width={Math.round(size * 0.82)}
        height={Math.round(size * 0.82)}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={(e) => {
          // Logo introuvable → teinte le cercle de la couleur de l'équipe
          const wrapper = e.currentTarget.parentElement
          if (wrapper) {
            wrapper.style.background = team.color
            wrapper.style.boxShadow = 'none'
          }
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}
