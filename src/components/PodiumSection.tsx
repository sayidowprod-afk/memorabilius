'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

interface PodiumEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  count: number
}

type Tab = 'day' | 'week' | 'month'

interface Props {
  month: PodiumEntry[]
  week: PodiumEntry[]
  day: PodiumEntry[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'day',   label: "Aujourd'hui" },
  { key: 'week',  label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
]

export default function PodiumSection({ month, week, day }: Props) {
  const { dark } = useTheme()
  const [tab, setTab] = useState<Tab>('month')

  if (month.length === 0 && week.length === 0 && day.length === 0) return null

  const entries = tab === 'day' ? day : tab === 'week' ? week : month

  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dowDiff = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowDiff)
  const weekLabel = `lun. ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — auj.`
  const subtitle = tab === 'day' ? dayLabel : tab === 'week' ? weekLabel : `Uploads — ${monthLabel}`

  const medals = ['🥇', '🥈', '🥉']
  const colors = ['#f39c12', '#95a5a6', '#cd7f32']
  const bgs = dark
    ? ['rgba(243,156,18,0.12)', 'rgba(149,165,166,0.10)', 'rgba(205,127,50,0.12)']
    : ['#fffbf0', '#f5f5f5', '#fdf6ef']

  const podiumOrder = entries.length >= 3
    ? [entries[1], entries[0], entries[2]]
    : entries.length === 2
    ? [entries[1], entries[0]]
    : entries.length === 1
    ? [entries[0]]
    : []
  const heights = entries.length >= 3 ? [80, 110, 60] : entries.length === 2 ? [80, 110] : [110]
  const realIdxMap = entries.length >= 3 ? [1, 0, 2] : entries.length === 2 ? [1, 0] : [0]

  const emptyMsg = tab === 'day'
    ? "Aucune carte ajoutée aujourd'hui"
    : tab === 'week'
    ? 'Aucune carte ajoutée cette semaine'
    : 'Aucune carte ajoutée ce mois'

  return (
    <section style={{ marginBottom: 60 }}>
      <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12, color: dark ? '#fff' : '#121212' }}>
        🏆 Podium
      </h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: tab === t.key ? '#003DA6' : dark ? '#2a2a2a' : '#f0f0f0',
              color: tab === t.key ? '#fff' : dark ? '#aaa' : '#666',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#999', marginBottom: 24, fontWeight: 600 }}>
        {subtitle}
      </p>

      {entries.length === 0 ? (
        <p style={{ textAlign: 'center', color: dark ? '#555' : '#ccc', fontSize: 14, fontWeight: 600, padding: '24px 0' }}>
          {emptyMsg}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
            {podiumOrder.map((entry, i) => {
              const realIdx = realIdxMap[i]
              const h = heights[i]
              return (
                <Link key={entry.userId} href={`/galerie/${entry.userId}`}
                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: dark ? '#fff' : '#121212', margin: 0, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.displayName}</p>
                    <p style={{ fontSize: 11, color: colors[realIdx], fontWeight: 900, margin: '2px 0 0' }}>+{entry.count} cartes</p>
                  </div>
                  <div style={{ width: 80, height: h, background: bgs[realIdx], border: `2px solid ${colors[realIdx]}33`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: realIdx === 0 ? 22 : 18, fontWeight: 900, color: colors[realIdx] }}>{realIdx + 1}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {entries.length > 3 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400, margin: '16px auto 0' }}>
              {entries.slice(3).map((entry, i) => (
                <Link key={entry.userId} href={`/galerie/${entry.userId}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: dark ? '#1e1e1e' : '#f8f8f8', borderRadius: 8, textDecoration: 'none', border: dark ? '1px solid #2a2a2a' : 'none' }}>
                  <span style={{ fontWeight: 900, fontSize: 13, color: '#bbb', width: 20 }}>{i + 4}</span>
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: dark ? '#2a2a2a' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: dark ? '#aaa' : '#666' }}>
                      {entry.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontWeight: 700, fontSize: 13, color: dark ? '#e0e0e0' : '#121212', flex: 1 }}>{entry.displayName}</span>
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 700 }}>+{entry.count}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
