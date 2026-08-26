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
  const url = teamLogoUrl(team)

  if (!url || failed) {
    // Pas de logo (foot sans crest, sport inconnu, ou logo introuvable) → pastille
    // colorée sans texte, seul cas où la couleur d'équipe reste visible.
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: team.color, flexShrink: 0,
      }} />
    )
  }

  // Monochrome (blanc en mode sombre, noir en mode clair) via filtre CSS plutôt
  // qu'un cercle blanc plein derrière le logo original — évite le halo blanc
  // disgracieux sur fond sombre, et fond bien la petite icône dans l'UI existante
  // (texte/icônes) au lieu de crier en couleurs à côté du nom.
  return (
    <img
      src={url}
      alt={team.name}
      title={team.name}
      width={size}
      height={size}
      style={{
        objectFit: 'contain', display: 'block', flexShrink: 0,
        filter: dark ? 'brightness(0) invert(1)' : 'brightness(0)',
      }}
      onError={() => setFailed(true)}
    />
  )
}
