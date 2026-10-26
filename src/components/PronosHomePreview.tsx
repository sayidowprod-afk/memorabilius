'use client'
import { useEffect, useState } from 'react'
import { Anton } from 'next/font/google'
import TeamBadge from '@/components/TeamBadge'
import { getTeamById } from '@/lib/sportsTeams'
import { useAuth } from '@/lib/AuthContext'
import { nextDays } from '@/lib/pronosDays'

// ─────────────────────────────────────────────────────────────
// MAQUETTE LOCALE — module Pronos intégré à l'accueil, sous la carte
// du jour, visible uniquement connecté. Matchs réels (NBA/NFL/NHL) via
// /api/pronos/matches (api-sports.io, plan gratuit). MLB et Champions
// League affichés en "Bientôt disponible" -- leur plan gratuit n'a pas
// accès à la saison en cours. Pas de page /pronos séparée.
// ─────────────────────────────────────────────────────────────

const anton = Anton({ weight: '400', subsets: ['latin'] })
const SURFQUEST = "'Surfquest', Impact, 'Arial Narrow', sans-serif"
// Surfquest/Anton sont des fontes d'affichage (condensées, pensées pour du
// gros texte) -- illisibles en dessous d'~20px. Tout le texte d'interface
// (filtres, badges, VS, heure) passe par une sans-serif system classique.
const UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'football'

interface ApiMatch {
  id: string
  sport: Sport
  day: string
  leftId: string
  rightId: string
  time: string
  status: 'upcoming' | 'final'
  locked: boolean
  leftScore?: number
  rightScore?: number
  winner?: 'left' | 'right'
}

const SPORT_INFO: Record<Sport, { label: string; short: string; logo: string; soon?: boolean }> = {
  nba: { label: 'NBA', short: 'NBA', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png' },
  nfl: { label: 'NFL', short: 'NFL', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png' },
  nhl: { label: 'NHL', short: 'NHL', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png' },
  mlb: { label: 'MLB', short: 'MLB', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png' },
  football: { label: 'Champions League', short: 'UCL', logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png' },
}

const GREEN = '#1fae4a'
const GOLD = '#d4a017'
const NAVY = '#0d1840'

// Dégradé couleur d'équipe → marine au centre.
function sideGradient(color: string, side: 'left' | 'right') {
  return side === 'left'
    ? `linear-gradient(90deg, ${color} 0%, ${color} 42%, ${NAVY} 100%)`
    : `linear-gradient(90deg, ${NAVY} 0%, ${color} 58%, ${color} 100%)`
}

// Bilan fictif mais stable par équipe (même équipe = même bilan partout sur
// la page), en attendant le vrai classement côté backend.
function fakeRecord(teamId: string): string {
  let h = 0
  for (const c of teamId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `${h % 10}-${Math.floor(h / 10) % 8}`
}

// Surfquest dessine ses chiffres nettement plus petits que ses lettres
// capitales (visible sur "76ERS") -- on compense en agrandissant les runs
// de chiffres dans le nom de l'équipe. En `em` (relatif à la taille de
// police héritée) pour rester correct que le nom soit affiché en grand
// (desktop) ou réduit (mobile, voir .pronos-name).
function NameDigits({ text }: { text: string }) {
  const parts = text.split(/([0-9]+)/)
  return (
    <>
      {parts.map((p, i) => /^[0-9]+$/.test(p)
        ? <span key={i} style={{ fontSize: '1.3em' }}>{p}</span>
        : p)}
    </>
  )
}

function TeamHalf({
  team, score, side, onClick, clickable, picked,
}: {
  team: ReturnType<typeof getTeamById>; score?: number
  side: 'left' | 'right'; onClick: () => void; clickable: boolean; picked?: boolean
}) {
  if (!team) return null
  const logo = (
    <div className="pronos-white-circle pronos-logo" style={{
      background: '#fff', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: picked ? `0 0 0 4px ${GREEN}` : 'none',
    }}>
      {/* Taille fixe en JS (TeamBadge ne connaît pas les media queries) --
          volontairement petite : le cercle qui l'entoure, lui, est fluide
          via CSS (.pronos-logo), donc un peu de marge sur desktop plutôt
          qu'un débordement sur mobile. */}
      <TeamBadge teamId={team.id} size={32} />
    </div>
  )
  const bigName = team.name.split(' ').slice(-1)[0]
  // Un nom qui commence par un chiffre (ex: "76ers") a un blanc visuel plus
  // grand au-dessus (le chiffre, plus petit, "flotte" plus bas dans sa ligne)
  // -- on resserre davantage dans ce cas pour garder un espacement uniforme.
  const cityGap = /^[0-9]/.test(bigName) ? -11 : -2
  const nameBlock = (
    <div className="pronos-name-block" style={{ lineHeight: 1, textAlign: side === 'left' ? 'left' : 'right' }}>
      <div className="pronos-city" style={{ fontFamily: SURFQUEST, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: cityGap }}>
        {team.name.split(' ').slice(0, -1).join(' ') || team.name}
      </div>
      <div className="pronos-name" style={{ fontFamily: SURFQUEST, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        <NameDigits text={bigName} />
      </div>
    </div>
  )
  const scoreEl = score !== undefined
    ? <span className={`${anton.className} pronos-score`} style={{ color: '#fff' }}>{score}</span>
    : null
  const recordEl = <span className={`${anton.className} pronos-record`} style={{ color: 'rgba(255,255,255,.85)' }}>{fakeRecord(team.id)}</span>

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className="pronos-half"
      style={{
        cursor: clickable ? 'pointer' : 'default', fontFamily: anton.style.fontFamily,
        justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
      }}
    >
      {side === 'left' ? (
        <>{logo}{recordEl}{nameBlock}{scoreEl && <span style={{ marginLeft: 'auto' }}>{scoreEl}</span>}</>
      ) : (
        <>{scoreEl && <span style={{ marginRight: 'auto' }}>{scoreEl}</span>}{nameBlock}{recordEl}{logo}</>
      )}
    </div>
  )
}

function MatchRow({ m, pick, onPick }: { m: ApiMatch; pick?: 'left' | 'right'; onPick: (id: string, side: 'left' | 'right') => void }) {
  const left = getTeamById(m.leftId)
  const right = getTeamById(m.rightId)
  if (!left || !right) return null

  const clickable = m.status === 'upcoming' && !m.locked

  const leftBg = m.status === 'final'
    ? (m.winner === 'left' ? sideGradient(GOLD, 'left') : sideGradient(left.color, 'left'))
    : (pick === 'left' ? sideGradient(GREEN, 'left') : sideGradient(left.color, 'left'))
  const rightBg = m.status === 'final'
    ? (m.winner === 'right' ? sideGradient(GOLD, 'right') : sideGradient(right.color, 'right'))
    : (pick === 'right' ? sideGradient(GREEN, 'right') : sideGradient(right.color, 'right'))

  return (
    <div className="pronos-row">
      <div style={{ flex: 1, display: 'flex', background: leftBg }}>
        <TeamHalf team={left} score={m.status === 'final' ? m.leftScore : undefined}
          side="left" clickable={clickable} onClick={() => onPick(m.id, 'left')}
          picked={pick === 'left'} />
      </div>

      <div className="pronos-center" style={{ background: NAVY }}>
        <div className="pronos-sport-badge" style={{ background: 'rgba(255,255,255,.14)' }}>
          <SportLogo sport={m.sport} size={16} />
          <span style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
            {SPORT_INFO[m.sport].short}
          </span>
        </div>
        <div className="pronos-white-circle pronos-vs-circle" style={{ background: '#fff', color: NAVY }}>
          <span style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 13, color: NAVY }}>VS</span>
        </div>
        <span style={{ fontFamily: UI_FONT, fontWeight: 700, fontSize: 14, color: '#fff' }}>{m.time}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', background: rightBg }}>
        <TeamHalf team={right} score={m.status === 'final' ? m.rightScore : undefined}
          side="right" clickable={clickable} onClick={() => onPick(m.id, 'right')}
          picked={pick === 'right'} />
      </div>
    </div>
  )
}

// Tous les cadres sont collés (un seul bloc, pas d'espace entre les
// matchs) : un seul bord blanc autour de la liste, un simple filet entre
// chaque ligne.
function MatchList({ matches, picks, onPick }: { matches: ApiMatch[]; picks: Record<string, 'left' | 'right'>; onPick: (id: string, side: 'left' | 'right') => void }) {
  return (
    <div style={{ border: '4px solid #fff', borderRadius: 0, overflow: 'hidden' }}>
      {matches.map((m, i) => (
        <div key={m.id} style={{ borderTop: i > 0 ? '2px solid #fff' : 'none' }}>
          <MatchRow m={m} pick={picks[m.id]} onPick={onPick} />
        </div>
      ))}
    </div>
  )
}

// La regle globale dark-mode de globals.css force tout <div> a fond blanc
// inline vers un fond sombre (`[style*="background: #fff"] { background:
// var(--bg2) !important }`) -- voir ShareButton.tsx pour le meme probleme
// cote texte. Ici c'est le fond du cercle VS/logo qui est touche : on le
// reaffirme avec une classe plus specifique que la regle globale.
// Regroupe le correctif dark-mode (ci-dessus) et toute la mise en page
// fluide (tailles/empilement) : les media queries ne peuvent pas vivre
// dans un `style` React inline, donc ces propriétés sortent du JSX vers
// de vraies classes CSS ici -- seules les couleurs dynamiques (dégradés
// par équipe, etc.) restent en inline style sur les éléments.
function PronosCSS() {
  return (
    <style>{`
html[data-theme="dark"] .pronos-white-circle { background: #fff !important; }

.pronos-row { display: flex; align-items: stretch; min-height: 108px; }
.pronos-half { flex: 1; display: flex; align-items: center; gap: 14px; padding: 12px 22px; }
.pronos-logo { width: 64px; height: 64px; flex-shrink: 0; }
.pronos-record { font-size: 20px; }
.pronos-city { font-size: 18px; }
.pronos-name { font-size: 44px; }
.pronos-score { font-size: 46px; }
.pronos-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 18px; flex-shrink: 0; width: 150px; }
.pronos-sport-badge { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; border-radius: 999px; padding: 3px 10px 3px 6px; }
.pronos-vs-circle { width: 34px; height: 34px; margin: 5px 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; }

@media (max-width: 680px) {
  .pronos-row { flex-direction: column; }
  .pronos-half { padding: 10px 14px; gap: 10px; }
  .pronos-logo { width: 40px; height: 40px; }
  .pronos-record { font-size: 14px; }
  .pronos-city { font-size: 10px; }
  .pronos-name { font-size: 22px; }
  .pronos-score { font-size: 26px; }
  .pronos-center { width: 100%; flex-direction: row; padding: 6px 10px; gap: 8px; }
  .pronos-sport-badge { margin-bottom: 0; }
  .pronos-vs-circle { width: 26px; height: 26px; margin: 0; }
}
`}</style>
  )
}

function SportLogo({ sport, size = 20 }: { sport: Sport; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span style={{ fontSize: size * 0.8 }}>🏆</span>
  return (
    <img src={SPORT_INFO[sport].logo} alt="" width={size} height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }} onError={() => setFailed(true)} />
  )
}

export default function PronosHomePreview() {
  const { user } = useAuth()
  const [matches, setMatches] = useState<ApiMatch[] | null>(null)
  const [days, setDays] = useState<string[]>(() => nextDays(7).map(d => d.label))
  const [activeDay, setActiveDay] = useState(days[0])
  const [activeSport, setActiveSport] = useState<Sport | 'ALL'>('ALL')
  const [picks, setPicks] = useState<Record<string, 'left' | 'right'>>({})

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/pronos/matches')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setMatches(data.matches ?? [])
        if (data.days?.length) { setDays(data.days); setActiveDay(d => d || data.days[0]) }
      })
      .catch(() => { if (!cancelled) setMatches([]) })
    return () => { cancelled = true }
  }, [user])

  // Pas connecté -- module masqué, aucun appel supplémentaire.
  if (!user) return null

  const handlePick = (id: string, side: 'left' | 'right') => {
    setPicks(p => (p[id] === side ? { ...p, [id]: undefined as any } : { ...p, [id]: side }))
  }

  const visible = (matches ?? []).filter(m => m.day === activeDay && (activeSport === 'ALL' || m.sport === activeSport))

  const pillBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999,
    fontFamily: UI_FONT, fontWeight: 700, fontSize: 14, letterSpacing: 0.2, whiteSpace: 'nowrap', cursor: 'pointer',
    border: '2px solid transparent',
  }

  return (
    <section style={{ background: NAVY, padding: '32px 20px 48px' }}>
      <PronosCSS />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ fontFamily: SURFQUEST, fontSize: 28, color: '#fff', letterSpacing: 1, margin: '0 0 20px' }}>
          🏆 PRONOS
        </h2>

        {/* Sélecteur de sport -- NBA/NFL/NHL cliquables (vraies données),
            MLB/UCL affichés en "Bientôt disponible" (plan gratuit api-sports
            sans accès à la saison en cours pour ces deux-là). */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          <button onClick={() => setActiveSport('ALL')} style={{
            ...pillBase,
            background: activeSport === 'ALL' ? '#fff' : 'rgba(255,255,255,.08)',
            color: activeSport === 'ALL' ? NAVY : '#fff',
          }}>
            Toutes
          </button>
          {(Object.keys(SPORT_INFO) as Sport[]).map(s => {
            const info = SPORT_INFO[s]
            if (info.soon) {
              return (
                <div key={s} style={{
                  ...pillBase, cursor: 'default', background: 'rgba(255,255,255,.04)',
                  color: 'rgba(255,255,255,.35)', border: '2px dashed rgba(255,255,255,.15)',
                }}>
                  <SportLogo sport={s} size={18} />
                  {info.label}
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>· BIENTÔT</span>
                </div>
              )
            }
            return (
              <button key={s} onClick={() => setActiveSport(s)} style={{
                ...pillBase,
                background: activeSport === s ? '#fff' : 'rgba(255,255,255,.08)',
                color: activeSport === s ? NAVY : '#fff',
              }}>
                <SportLogo sport={s} size={18} />
                {info.label}
              </button>
            )
          })}
        </div>

        {/* Sélecteur de jour */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 20 }}>
          {days.map(d => (
            <button key={d} onClick={() => setActiveDay(d)} style={{
              ...pillBase,
              background: d === activeDay ? '#fff' : 'rgba(255,255,255,.08)',
              color: d === activeDay ? NAVY : '#fff',
            }}>
              {d}
            </button>
          ))}
        </div>

        {matches === null ? (
          <p style={{ fontFamily: UI_FONT, fontWeight: 600, color: 'rgba(255,255,255,.6)', fontSize: 16, textAlign: 'center', padding: '40px 0' }}>
            Chargement des matchs...
          </p>
        ) : visible.length > 0 ? (
          <MatchList matches={visible} picks={picks} onPick={handlePick} />
        ) : (
          <p style={{ fontFamily: UI_FONT, fontWeight: 600, color: 'rgba(255,255,255,.6)', fontSize: 16, textAlign: 'center', padding: '40px 0' }}>
            Aucun match ce jour-là.
          </p>
        )}
      </div>
    </section>
  )
}
