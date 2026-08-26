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

// Casse le cache (navigateur + service worker, voir public/sw.js qui met les
// images en cache-first sans jamais revalider) -- ces fichiers sont modifies
// en place sous le meme nom, donc sans ca un fichier remplace reste servi
// depuis le cache jusqu'a max-age (24h) ou expiration du cache d'images du SW.
const LOGO_CACHE_BUST = 'v4'

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const { dark } = useTheme()
  const [customExtIndex, setCustomExtIndex] = useState(0)
  const [colorFailed, setColorFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null

  // 1. Logo maison si dispo -- rendu en image de fond CSS (pas une balise <img>) :
  // un carre blanc plein apparaissait systematiquement avec <img> quelle que soit
  // la taille source/affichage (confirme sur plusieurs captures reelles), un
  // chemin de rendu different pour ecarter un souci de compositing sur <img>.
  if (customExtIndex < CUSTOM_LOGO_EXTENSIONS.length) {
    const ext = CUSTOM_LOGO_EXTENSIONS[customExtIndex]
    const src = `/team-logos/${teamId.replace(':', '-')}.${ext}?${LOGO_CACHE_BUST}`
    return (
      <>
        <img src={src} alt="" width={0} height={0} style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onError={() => setCustomExtIndex(i => i + 1)} />
        <div
          role="img"
          aria-label={team.name}
          title={team.name}
          style={{
            width: size, height: size, flexShrink: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
          }}
        />
      </>
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
