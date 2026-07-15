'use client'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const team = getTeamById(teamId)
  if (!team) return null
  return (
    <div style={{ width: size, height: size, flexShrink: 0, background: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={teamLogoUrl(team)}
        alt={team.name}
        title={team.name}
        width={size - 4}
        height={size - 4}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={(e) => {
          const el = e.currentTarget
          const wrapper = el.parentElement!
          wrapper.style.background = team.color
          wrapper.style.borderRadius = '50%'
          el.style.display = 'none'
          const span = document.createElement('span')
          span.textContent = team.abbr
          span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;color:white;font-size:${Math.round(size * 0.32)}px;font-weight:900;letter-spacing:-0.5px`
          wrapper.appendChild(span)
        }}
      />
    </div>
  )
}
