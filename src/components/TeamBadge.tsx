'use client'
import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

// Logo maison, fond transparent -- voir public/team-logos/README.md pour le
// format et la liste des fichiers attendus. Essaie chaque extension dans
// l'ordre (une equipe peut avoir un .svg, une autre un .webp) et bascule sur
// le logo couleur officiel si aucune n'existe (onError ci-dessous).
const CUSTOM_LOGO_EXTENSIONS = ['svg', 'png', 'webp']

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const { dark } = useTheme()
  const [customExtIndex, setCustomExtIndex] = useState(0)
  const [colorFailed, setColorFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null

  // 1. Logo maison si dispo -- affiche tel quel, SANS filtre CSS. Le filtre
  // (brightness/invert) rendait un carre plein blanc en mode sombre au lieu du
  // logo -- confirme par capture d'ecran reelle, pas juste par calcul. Sans
  // filtre ca marche (meme traitement que le fallback couleur ci-dessous, qui
  // lui n'a jamais pose probleme).
  if (customExtIndex < CUSTOM_LOGO_EXTENSIONS.length) {
    const ext = CUSTOM_LOGO_EXTENSIONS[customExtIndex]
    return (
      <img
        src={`/team-logos/${teamId.replace(':', '-')}.${ext}`}
        alt={team.name}
        title={team.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
        onError={() => setCustomExtIndex(i => i + 1)}
      />
    )
  }

  // 2. Fallback : logo couleur officiel, sans fond derriere.
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
