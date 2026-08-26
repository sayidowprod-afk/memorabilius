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
  const [colorFailed, setColorFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null

  // Logo couleur officiel, sans fond derriere.
  const url = teamLogoUrl(team, dark)
  if (!url || colorFailed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
    )
  }

  return (
    <img
      src={url}
      alt={team.name}
      title={team.name}
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
      onError={() => setColorFailed(true)}
    />
  )
}
