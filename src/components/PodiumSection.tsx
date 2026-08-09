'use client'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

interface PodiumEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  count: number
}

interface Props {
  month: PodiumEntry[]
  week: PodiumEntry[]
  day: PodiumEntry[]
}

const medals = ['🥇', '🥈', '🥉']
const colors = ['#f39c12', '#95a5a6', '#cd7f32']

function PodiumColumn({ title, subtitle, entries, dark }: {
  title: string; subtitle: string; entries: PodiumEntry[]; dark: boolean
}) {
  return (
    <div style={{
      background: dark ? '#111' : '#fafafa',
      borderRadius: 12,
      padding: '14px 12px',
      border: dark ? '1px solid #222' : '1px solid #eee',
      minWidth: 0,
      flex: '1 1 0',
    }}>
      <p style={{ fontWeight: 900, fontSize: 13, color: dark ? '#fff' : '#121212', margin: '0 0 2px' }}>{title}</p>
      <p style={{ fontSize: 11, color: '#999', fontWeight: 600, margin: '0 0 10px' }}>{subtitle}</p>

      {entries.length === 0 ? (
        <p style={{ fontSize: 12, color: dark ? '#444' : '#ccc', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
          Aucune carte
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {entries.map((entry, i) => (
            <Link key={entry.userId} href={`/galerie/${entry.userId}`}
              style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
              <span style={{ fontSize: i < 3 ? 15 : 11, width: 20, textAlign: 'center', flexShrink: 0, fontWeight: 900, color: i >= 3 ? '#bbb' : undefined }}>
                {i < 3 ? medals[i] : i + 1}
              </span>
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.displayName}
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? colors[i] + '30' : dark ? '#2a2a2a' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i < 3 ? colors[i] : dark ? '#aaa' : '#888', flexShrink: 0 }}>
                  {entry.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: dark ? '#e0e0e0' : '#121212', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.displayName}
              </span>
              <span style={{ fontSize: 11, fontWeight: 900, color: i < 3 ? colors[i] : '#bbb', flexShrink: 0 }}>
                +{entry.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PodiumSection({ month, week, day }: Props) {
  const { dark } = useTheme()
  if (month.length === 0 && week.length === 0 && day.length === 0) return null

  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dowDiff = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowDiff)
  const weekLabel = `lun. ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — auj.`

  return (
    <section style={{ marginBottom: 60 }}>
      <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 16, color: dark ? '#fff' : '#121212' }}>
        🏆 Podium
      </h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <PodiumColumn title="Aujourd'hui" subtitle={dayLabel} entries={day} dark={dark} />
        <PodiumColumn title="Cette semaine" subtitle={weekLabel} entries={week} dark={dark} />
        <PodiumColumn title="Ce mois" subtitle={monthLabel} entries={month} dark={dark} />
      </div>
    </section>
  )
}
