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

  // 1. Logo maison si dispo -- passe en noir (mode clair) ou blanc (mode sombre)
  // via filtre CSS, quelle que soit la couleur d'origine du fichier source.
  // Marche bien ici car ce sont des icones simples dessinees expres pour ca,
  // contrairement aux logos officiels detailles qui deviennent illisibles une
  // fois reduits en silhouette (teste sur NBA/foot -- meme resultat illisible).
  if (customExtIndex < CUSTOM_LOGO_EXTENSIONS.length) {
    const ext = CUSTOM_LOGO_EXTENSIONS[customExtIndex]
    return (
      <img
        src={`/team-logos/${teamId.replace(':', '-')}.${ext}`}
        alt={team.name}
        title={team.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0, filter: dark ? 'brightness(0) invert(1)' : 'brightness(0)' }}
        onError={() => setCustomExtIndex(i => i + 1)}
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
