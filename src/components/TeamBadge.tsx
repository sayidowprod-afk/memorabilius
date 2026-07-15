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
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: team.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'white', fontSize: Math.round(size * 0.32), fontWeight: 900, letterSpacing: '-0.5px' }}>{team.abbr}</span>
      </div>
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
      onError={(e) => {
        const el = e.currentTarget
        el.style.display = 'none'
        const wrapper = document.createElement('div')
        wrapper.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${team.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0`
        const span = document.createElement('span')
        span.textContent = team.abbr
        span.style.cssText = `color:white;font-size:${Math.round(size * 0.32)}px;font-weight:900;letter-spacing:-0.5px`
        wrapper.appendChild(span)
        el.parentElement?.insertBefore(wrapper, el)
      }}
    />
  )
}
