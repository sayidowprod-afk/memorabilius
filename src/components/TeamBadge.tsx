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

// Rendu partage en image de fond CSS (pas une balise <img>) : un carre plein
// apparaissait systematiquement avec <img>, quels que soient le filtre, la
// taille source/affichage ou le cache -- confirme sur plusieurs captures
// reelles. Le div en image de fond n'a jamais eu ce probleme.
function LogoBox({ src, alt, size, invert }: { src: string; alt: string; size: number; invert?: boolean }) {
  return (
    <div
      role="img"
      aria-label={alt}
      title={alt}
      style={{
        width: size, height: size, flexShrink: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        filter: invert ? 'invert(1)' : 'none',
      }}
    />
  )
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const { dark } = useTheme()
  const [customExtIndex, setCustomExtIndex] = useState(0)
  const [colorFailed, setColorFailed] = useState(false)
  const team = getTeamById(teamId)
  if (!team) return null

  // 1. Logo maison si dispo -- noir sur transparent, invert(1) le bascule en
  // blanc en mode sombre. NBA exclue : revient au logo ESPN officiel en
  // couleur, sans fond, a la demande.
  if (team.sport !== 'nba' && customExtIndex < CUSTOM_LOGO_EXTENSIONS.length) {
    const ext = CUSTOM_LOGO_EXTENSIONS[customExtIndex]
    const src = `/team-logos/${teamId.replace(':', '-')}.${ext}?${LOGO_CACHE_BUST}`
    return (
      <>
        {/* <img> invisible en parallele juste pour detecter les 404 (onError) --
            le rendu visible passe par LogoBox, pas cette balise. */}
        <img loading="lazy" src={src} alt="" width={0} height={0} style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onError={() => setCustomExtIndex(i => i + 1)} />
        <LogoBox src={src} alt={team.name} size={size} invert={dark} />
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
    <>
      <img loading="lazy" src={url} alt="" width={0} height={0} style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onError={() => setColorFailed(true)} />
      <LogoBox src={url} alt={team.name} size={size} />
    </>
  )
}
