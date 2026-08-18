'use client'
import Link from 'next/link'
import { useState } from 'react'

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

function PodiumColumn({ entries }: { entries: PodiumEntry[] }) {
  return (
    <div className="podium-col">
      {entries.length === 0 ? (
        <p className="podium-empty">Aucune carte</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry, i) => (
            <Link key={entry.userId} href={`/galerie/${entry.userId}`} className="podium-row">
              <span className={`podium-rank ${i < 3 ? 'podium-rank-medal' : ''}`}>
                {i < 3 ? medals[i] : i + 1}
              </span>
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.displayName} className="podium-avatar" />
              ) : (
                <div className="podium-avatar podium-avatar-placeholder" style={{ color: i < 3 ? colors[i] : undefined }}>
                  {entry.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="podium-name">{entry.displayName}</span>
              <span className="podium-count" style={{ color: i < 3 ? colors[i] : undefined }}>
                +{entry.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = 'day' | 'week' | 'month'

export default function PodiumSection({ month, week, day }: Props) {
  const [tab, setTab] = useState<Tab>('day')

  if (month.length === 0 && week.length === 0 && day.length === 0) return null

  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dowDiff = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowDiff)
  const weekLabel = `lun. ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — auj.`

  const tabs: { key: Tab; label: string; subtitle: string; entries: PodiumEntry[] }[] = [
    { key: 'day',   label: "Aujourd'hui",    subtitle: dayLabel,   entries: day },
    { key: 'week',  label: 'Cette semaine',  subtitle: weekLabel,  entries: week },
    { key: 'month', label: 'Ce mois',        subtitle: monthLabel, entries: month },
  ]

  const active = tabs.find(t => t.key === tab)!

  return (
    <section style={{ marginBottom: 60 }}>
      <style>{`
        .podium-col {
          background: var(--podium-bg, #fafafa);
          border: 1px solid var(--border, #eee);
          border-radius: 12px;
          padding: 14px 12px;
          min-width: 0;
          flex: 1 1 0;
        }
        [data-theme="dark"] .podium-col,
        @media (prefers-color-scheme: dark) { .podium-col }
        [data-theme="dark"] .podium-col { background: #111; border-color: #222; }

        .podium-empty { font-size: 12px; color: #999; text-align: center; padding: 12px 0; font-weight: 600; }
        .podium-row { display: flex; align-items: center; gap: 7px; text-decoration: none; }
        .podium-rank { font-size: 11px; width: 20px; text-align: center; flex-shrink: 0; font-weight: 900; color: #bbb; }
        .podium-rank-medal { font-size: 15px; color: unset; }
        .podium-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .podium-avatar-placeholder { background: #eee; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; }
        [data-theme="dark"] .podium-avatar-placeholder { background: #2a2a2a; }
        .podium-name { flex: 1; font-size: 12px; font-weight: 700; color: #121212; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        [data-theme="dark"] .podium-name { color: #e0e0e0; }
        .podium-count { font-size: 11px; font-weight: 900; color: #bbb; flex-shrink: 0; }

        /* Desktop: 3 colonnes */
        .podium-desktop { display: flex; gap: 10; align-items: stretch; }
        .podium-desktop .podium-col-header { display: block; }
        .podium-col-header-title { font-weight: 900; font-size: 13px; color: #121212; margin: 0 0 2px; }
        [data-theme="dark"] .podium-col-header-title { color: #fff; }
        .podium-col-header-sub { font-size: 11px; color: #999; font-weight: 600; margin: 0 0 10px; }

        /* Tabs mobile */
        .podium-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
        .podium-tab {
          flex: 1; padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border, #eee);
          background: none; cursor: pointer; font-size: 12px; font-weight: 700;
          color: #888; transition: all .15s;
        }
        .podium-tab.active { background: #003DA6; color: #fff; border-color: #003DA6; }
        [data-theme="dark"] .podium-tab { border-color: #333; color: #aaa; }
        [data-theme="dark"] .podium-tab.active { background: #003DA6; color: #fff; }
        .podium-tab-sub { font-size: 10px; font-weight: 500; opacity: .75; display: block; margin-top: 2px; }

        @media (min-width: 640px) {
          .podium-mobile { display: none !important; }
          .podium-desktop { display: flex !important; }
        }
        @media (max-width: 639px) {
          .podium-mobile { display: block !important; }
          .podium-desktop { display: none !important; }
        }
      `}</style>

      <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 16, textAlign: 'center' }}>🏆 Podium</h2>

      {/* Mobile : tabs */}
      <div className="podium-mobile">
        <div className="podium-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`podium-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="podium-tab-sub">{t.subtitle}</span>
            </button>
          ))}
        </div>
        <PodiumColumn entries={active.entries} />
      </div>

      {/* Desktop : 3 colonnes */}
      <div className="podium-desktop" style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        {tabs.map(t => (
          <div key={t.key} style={{ flex: '1 1 0', minWidth: 0 }}>
            <p className="podium-col-header-title">{t.label}</p>
            <p className="podium-col-header-sub">{t.subtitle}</p>
            <PodiumColumn entries={t.entries} />
          </div>
        ))}
      </div>
    </section>
  )
}
