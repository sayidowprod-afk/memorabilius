'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getTeamById } from '@/lib/sportsTeams'
import TeamBadge from '@/components/TeamBadge'

interface PodiumEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  count: number
  favoriteTeam?: string | null
}

interface Props {
  month: PodiumEntry[]
  week: PodiumEntry[]
  day: PodiumEntry[]
}

const RANK = ['#ffd54a', '#c9d1e0', '#e0925a']

// Un joueur : liseré (couleur de son equipe favorite) + petit logo
function teamBits(entry: PodiumEntry) {
  const team = entry.favoriteTeam ? getTeamById(entry.favoriteTeam) : null
  return { color: team?.color || null, id: team ? entry.favoriteTeam! : null }
}

function PodiumColumn({ entries }: { entries: PodiumEntry[] }) {
  if (entries.length === 0) return <div className="podium-col"><p className="podium-empty">Aucune carte</p></div>
  const [first, ...rest] = entries
  const t1 = teamBits(first)
  return (
    <div className="podium-col">
      <Link href={`/galerie/${first.userId}`} className="podium-hero" style={t1.color ? ({ ['--pt' as string]: t1.color } as React.CSSProperties) : undefined}>
        <span className="podium-hero-k da-display">1er</span>
        {first.avatarUrl ? <img src={first.avatarUrl} alt={first.displayName} className="podium-hero-av" /> : <span className="podium-hero-av podium-ini da-display">{first.displayName.charAt(0).toUpperCase()}</span>}
        <span className="podium-hero-name da-display">{first.displayName}</span>
        {t1.id && <span className="podium-lg"><TeamBadge teamId={t1.id} size={16} /></span>}
        <span className="podium-hero-v da-display">+{first.count}<small>cartes</small></span>
      </Link>
      <div className="podium-list">
        {rest.map((entry, i) => {
          const tb = teamBits(entry)
          return (
            <Link key={entry.userId} href={`/galerie/${entry.userId}`} className={`podium-row${tb.color ? ' podium-row-tm' : ''}`} style={tb.color ? ({ ['--pt' as string]: tb.color } as React.CSSProperties) : undefined}>
              <span className="podium-rank da-display" style={{ color: i < 2 ? RANK[i + 1] : undefined }}>{i + 2}</span>
              {entry.avatarUrl ? <img src={entry.avatarUrl} alt={entry.displayName} className="podium-avatar" /> : <span className="podium-avatar podium-ini da-display">{entry.displayName.charAt(0).toUpperCase()}</span>}
              <span className="podium-name da-display">{entry.displayName}</span>
              {tb.id && <span className="podium-lg"><TeamBadge teamId={tb.id} size={15} /></span>}
              <span className="podium-count da-display">+{entry.count}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

type Tab = 'day' | 'week' | 'month'

export default function PodiumSection({ month, week, day }: Props) {
  const [tab, setTab] = useState<Tab>('day')
  // Calcule les libelles cote client uniquement (apres montage), jamais pendant le
  // rendu initial -- cette section est SSR/ISR (revalidate 5min), donc `new Date()`
  // au rendu server pouvait differer de l'heure reelle du visiteur au moment de
  // l'hydratation (cache ISR ou fallback du Service Worker servant un HTML plus
  // vieux) : le texte ne correspondait plus a ce que React re-calculait cote client,
  // provoquant une erreur d'hydratation NON rattrapee (React #418) qui plantait la
  // page entiere -- observe en prod (console) comme un chargement bloque
  // indefiniment. Meme contenu (vide) au 1er rendu server ET client, rempli ensuite.
  const [labels, setLabels] = useState<{ day: string; week: string; month: string } | null>(null)

  useEffect(() => {
    const now = new Date()
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const dowDiff = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dowDiff)
    const weekLabel = `lun. ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — auj.`
    setLabels({ day: dayLabel, week: weekLabel, month: monthLabel })
  }, [])

  if (month.length === 0 && week.length === 0 && day.length === 0) return null

  const monthLabel = labels?.month ?? ''
  const dayLabel = labels?.day ?? ''
  const weekLabel = labels?.week ?? ''

  const tabs: { key: Tab; label: string; subtitle: string; entries: PodiumEntry[] }[] = [
    { key: 'day',   label: "Aujourd'hui",    subtitle: dayLabel,   entries: day },
    { key: 'week',  label: 'Cette semaine',  subtitle: weekLabel,  entries: week },
    { key: 'month', label: 'Ce mois',        subtitle: monthLabel, entries: month },
  ]

  const active = tabs.find(t => t.key === tab)!

  return (
    <section style={{ marginBottom: 60 }}>
      <style>{`
        .podium-col { min-width: 0; flex: 1 1 0; }
        .podium-empty { font-size: 12px; color: #999; text-align: center; padding: 12px 0; font-weight: 600; }
        .podium-hero { position: relative; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 14px 12px 12px; text-decoration: none; border: 3px solid #ffd54a;
          background: linear-gradient(135deg, rgba(255,213,74,0.16), transparent 70%); border-left: 6px solid var(--pt, #ffd54a); }
        .podium-hero-k { position: absolute; top: -3px; left: -3px; background: #ffd54a; color: #06122e !important; font-size: 15px; line-height: 1; padding: 4px 9px 2px; }
        .podium-hero-av { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .podium-ini { background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; color: inherit; }
        .podium-hero-name { flex: 1; min-width: 0; font-size: 32px; line-height: .95; color: #fff; overflow-wrap: anywhere; }
        .podium-hero-v { flex-shrink: 0; text-align: right; font-size: 50px; line-height: .9; color: #ffd54a; }
        .podium-hero-v small { display: block; font: 700 9px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-top: 4px; }
        .podium-lg { display: inline-flex; flex-shrink: 0; }
        .podium-list { border-top: 3px solid #fff; }
        .podium-row { display: flex; align-items: center; gap: 9px; text-decoration: none; padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,0.14); border-left: 5px solid rgba(255,255,255,0.18); transition: background-color 0.15s; }
        .podium-row-tm { border-left-color: var(--pt); background: linear-gradient(90deg, color-mix(in srgb, var(--pt) 22%, transparent), transparent 60%); }
        @media (hover: hover) and (pointer: fine) { .podium-row:hover { background-color: rgba(120,140,200,0.12); } }
        .podium-rank { font-size: 20px; line-height: 1; width: 24px; text-align: center; flex-shrink: 0; color: rgba(255,255,255,0.45); }
        .podium-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; font-size: 14px; }
        .podium-name { flex: 1; min-width: 0; font-size: 20px; line-height: 1; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .podium-count { font-size: 20px; line-height: 1; color: #ffd54a; flex-shrink: 0; }

        .podium-desktop { display: flex; gap: 18px; align-items: flex-start; }
        .podium-col-header-title { margin: 0 0 2px; font-size: 28px; line-height: 1; color: #fff; }
        .podium-col-header-sub { font: 700 11px system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0 0 10px; }

        /* Mobile : selecteur carre a 3 segments */
        .podium-tabs { display: flex; border: 2px solid #fff; margin-bottom: 8px; }
        .podium-tab { flex: 1; min-height: 40px; padding: 4px; border: 0; border-right: 2px solid #fff; background: transparent; color: #fff; cursor: pointer; font: 800 11px system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; border-radius: 0; }
        .podium-tab:last-child { border-right: 0; }
        .podium-tab.active { background: #fff; color: #06122e; }
        .podium-mobile-sub { font: 700 11px system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0 0 10px; }

        /* mode clair */
        [data-theme="light"] .podium-hero-name, [data-theme="light"] .podium-name, [data-theme="light"] .podium-col-header-title { color: #06122e; }
        [data-theme="light"] .podium-hero-v, [data-theme="light"] .podium-count { color: #b8860b; }
        [data-theme="light"] .podium-list { border-top-color: #06122e; }
        [data-theme="light"] .podium-row { border-bottom-color: rgba(6,18,46,0.14); border-left-color: rgba(6,18,46,0.18); }
        [data-theme="light"] .podium-rank, [data-theme="light"] .podium-col-header-sub, [data-theme="light"] .podium-mobile-sub { color: rgba(6,18,46,0.55); }
        [data-theme="light"] .podium-tabs { border-color: #06122e; }
        [data-theme="light"] .podium-tab { color: #06122e; border-right-color: #06122e; }
        [data-theme="light"] .podium-tab.active { background: #06122e; color: #fff; }
        [data-theme="light"] .podium-hero-v small { color: rgba(6,18,46,0.6); }
        @media (min-width: 640px) {
          .podium-mobile { display: none !important; }
          .podium-desktop { display: flex !important; }
        }
        @media (max-width: 639px) {
          .podium-mobile { display: block !important; }
          .podium-desktop { display: none !important; }
          .podium-hero-name { font-size: 26px; }
          .podium-hero-v { font-size: 40px; }
          .podium-hero-av { width: 42px; height: 42px; }
        }
      `}</style>

      <h2 className="da-display da-h2" style={{ fontWeight: 900, fontSize: 20, marginBottom: 16, textAlign: 'center' }}>🏆 Podium</h2>

      {/* Mobile : tabs */}
      <div className="podium-mobile">
        <div className="podium-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`podium-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="podium-mobile-sub">{active.subtitle}</p>
        <PodiumColumn entries={active.entries} />
      </div>

      {/* Desktop : 3 colonnes */}
      <div className="podium-desktop" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {tabs.map(t => (
          <div key={t.key} style={{ flex: '1 1 0', minWidth: 0 }}>
            <p className="podium-col-header-title da-display">{t.label}</p>
            <p className="podium-col-header-sub">{t.subtitle}</p>
            <PodiumColumn entries={t.entries} />
          </div>
        ))}
      </div>
    </section>
  )
}
