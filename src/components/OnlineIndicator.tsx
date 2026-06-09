'use client'

interface Props {
  lastSeen: string | null
  size?: number
}

export default function OnlineIndicator({ lastSeen, size = 10 }: Props) {
  if (!lastSeen) return null

  const diff = Date.now() - new Date(lastSeen).getTime()
  const mins = Math.floor(diff / 60000)

  let color = '#e74c3c' // hors ligne
  let label = 'Hors ligne'

  if (mins < 5) { color = '#2ecc71'; label = 'En ligne' }
  else if (mins < 60) { color = '#f39c12'; label = `Vu il y a ${mins}min` }
  else if (mins < 1440) { color = '#95a5a6'; label = `Vu il y a ${Math.floor(mins / 60)}h` }
  else { label = `Vu il y a ${Math.floor(mins / 1440)}j` }

  return (
    <span title={label} style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color,
      border: '2px solid white', flexShrink: 0,
      cursor: 'default',
    }} />
  )
}
