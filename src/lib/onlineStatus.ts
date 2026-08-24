// Meme logique de seuils que OnlineIndicator.tsx, exposee a part pour pouvoir
// colorer un anneau autour d'un avatar en plus du petit point existant.
export function onlineStatusColor(lastSeen: string | null): string | null {
  if (!lastSeen) return null
  const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000)
  if (mins < 5) return '#2ecc71'
  if (mins < 60) return '#f39c12'
  return null
}
