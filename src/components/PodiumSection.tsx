'use client'
import Link from 'next/link'

interface PodiumEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  count: number
}

export default function PodiumSection({ entries }: { entries: PodiumEntry[] }) {
  if (entries.length === 0) return null

  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const medals = ['🥇', '🥈', '🥉']
  const colors = ['#f39c12', '#95a5a6', '#cd7f32']
  const bgs = ['#fffbf0', '#f5f5f5', '#fdf6ef']

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = entries.length >= 3
    ? [entries[1], entries[0], entries[2]]
    : entries.length === 2
    ? [entries[1], entries[0]]
    : [entries[0]]

  const heights = entries.length >= 3 ? [80, 110, 60] : entries.length === 2 ? [80, 110] : [110]
  const realIdxMap = entries.length >= 3 ? [1, 0, 2] : entries.length === 2 ? [1, 0] : [0]

  return (
    <section style={{ marginBottom: 60 }}>
      <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 4, color: '#121212' }}>
        🏆 Podium du mois
      </h2>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 24, fontWeight: 600 }}>
        Concours uploads — {monthLabel}
      </p>

      {/* Mobile: liste */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
        {podiumOrder.map((entry, i) => {
          const realIdx = realIdxMap[i]
          const h = heights[i]
          return (
            <Link key={entry.userId} href={`/galerie/${entry.userId}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt={entry.displayName}
                    style={{ width: realIdx === 0 ? 72 : 56, height: realIdx === 0 ? 72 : 56, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${colors[realIdx]}` }} />
                ) : (
                  <div style={{ width: realIdx === 0 ? 72 : 56, height: realIdx === 0 ? 72 : 56, borderRadius: '50%', background: '#003DA6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: realIdx === 0 ? 24 : 18, border: `3px solid ${colors[realIdx]}` }}>
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 16 }}>{medals[realIdx]}</span>
              </div>

              {/* Nom + count */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: 13, color: '#121212', margin: 0, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.displayName}</p>
                <p style={{ fontSize: 11, color: colors[realIdx], fontWeight: 900, margin: '2px 0 0' }}>+{entry.count} cartes</p>
              </div>

              {/* Barre podium */}
              <div style={{ width: 80, height: h, background: bgs[realIdx], border: `2px solid ${colors[realIdx]}33`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: realIdx === 0 ? 22 : 18, fontWeight: 900, color: colors[realIdx] }}>{realIdx + 1}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Reste du classement si >3 */}
      {entries.length > 3 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400, margin: '16px auto 0' }}>
          {entries.slice(3).map((entry, i) => (
            <Link key={entry.userId} href={`/galerie/${entry.userId}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#f8f8f8', borderRadius: 8, textDecoration: 'none' }}>
              <span style={{ fontWeight: 900, fontSize: 13, color: '#bbb', width: 20 }}>{i + 4}</span>
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#666' }}>
                  {entry.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontWeight: 700, fontSize: 13, color: '#121212', flex: 1 }}>{entry.displayName}</span>
              <span style={{ fontSize: 12, color: '#999', fontWeight: 700 }}>+{entry.count}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
