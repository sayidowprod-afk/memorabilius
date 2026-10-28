'use client'
import { useEffect, useState } from 'react'
import { Anton } from 'next/font/google'
import TeamBadge from '@/components/TeamBadge'
import { getTeamById } from '@/lib/sportsTeams'
import { useAuth } from '@/lib/AuthContext'
import { dayLabel, daysForOffsets, weekOffsets } from '@/lib/pronosDays'
import { supabase } from '@/lib/supabase'
import type { BoxScore as BoxScoreData, BoxGroup as BoxScoreGroup } from '@/lib/pronosBoxscore'

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
// Pronostic : un camp, ou « draw » (match nul : football et NHL).
type Pick = 'left' | 'right' | 'draw'

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
  winner?: 'left' | 'right' | 'draw'
  drawable?: boolean
  note?: string
  leftRecord?: string
  rightRecord?: string
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
  team, score, record, side, onClick, clickable, picked,
}: {
  team: ReturnType<typeof getTeamById>; score?: number; record?: string
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
  // Bilan réel (ESPN/MLB) -- absent (ex: Champions League, pas encore
  // branché) plutôt que d'inventer un chiffre.
  const recordEl = record
    ? <span className={`${anton.className} pronos-record`} style={{ color: 'rgba(255,255,255,.85)' }}>{record}</span>
    : null

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

function MatchRow({ m, pick, onPick }: { m: ApiMatch; pick?: Pick; onPick: (id: string, side: Pick) => void }) {
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
        <TeamHalf team={left} score={m.status === 'final' ? m.leftScore : undefined} record={m.leftRecord}
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
        {m.status === 'final' && m.note && (
          <span style={{ fontFamily: UI_FONT, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{m.note}</span>
        )}
        {m.drawable && (clickable || m.status === 'final') && (
          <button type="button" className="pronos-draw" disabled={!clickable} onClick={() => onPick(m.id, 'draw')} aria-pressed={pick === 'draw'}
            style={{
              background: m.status === 'final' ? (m.winner === 'draw' ? GOLD : 'rgba(255,255,255,.1)') : (pick === 'draw' ? GREEN : 'rgba(255,255,255,.14)'),
              color: m.status === 'final' && m.winner === 'draw' ? '#1a1300' : '#fff',
              outline: m.status === 'final' && pick === 'draw' ? `2px solid ${m.winner === 'draw' ? GREEN : '#e74c3c'}` : 'none',
              cursor: clickable ? 'pointer' : 'default',
            }}>
            NUL
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', background: rightBg }}>
        <TeamHalf team={right} score={m.status === 'final' ? m.rightScore : undefined} record={m.rightRecord}
          side="right" clickable={clickable} onClick={() => onPick(m.id, 'right')}
          picked={pick === 'right'} />
      </div>
    </div>
  )
}

// ── Box score ─────────────────────────────────────────────────────────────
// Flèche sous chaque match commencé : ouvre un panneau refermable avec ton
// pronostic et les stats individuelles de chaque joueur (onglets d'équipe en
// haut, titulaires puis banc, comme les apps de scores). Les données ne sont
// demandées qu'à la première ouverture (/api/pronos/boxscore).
const BS_BG = '#0a1330'
const COLLAPSED_ROWS = 6

const POS_COLORS: Record<string, string> = {
  PG: '#ff5c93', SG: '#ff9f43', G: '#ff9f43', SF: '#2ee6a6', F: '#2ee6a6', PF: '#38bdf8', C: '#c084fc',
}

function PickSummary({ m, pick }: { m: ApiMatch; pick?: Pick }) {
  const team = pick && pick !== 'draw' ? getTeamById(pick === 'left' ? m.leftId : m.rightId) : null
  const label = pick === 'draw' ? 'Match nul' : team?.name
  let text: string, color = 'rgba(255,255,255,.75)'
  if (!pick || !label) {
    text = "Tu n'avais pas de pronostic sur ce match."
  } else if (m.status !== 'final') {
    text = `Ton pronostic : ${label} — match en cours`
  } else if (m.winner === pick) {
    text = `✓ Ton pronostic : ${label} — gagné (+5 XP)`; color = GREEN
  } else {
    text = `✗ Ton pronostic : ${label} — perdu`; color = '#e74c3c'
  }
  return <div style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 13, color, marginBottom: 14 }}>{text}</div>
}

function Avatar({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 'var(--bs-av)', height: 'var(--bs-av)', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src && !failed
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        : <span style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{initials}</span>}
    </div>
  )
}

function BoxGroupTable({ group, abbr, expanded }: { group: BoxScoreGroup; abbr?: string; expanded: boolean }) {
  const cols = `var(--bs-first) repeat(${group.labels.length}, minmax(var(--bs-col), 1fr))`
  const cell: React.CSSProperties = { padding: '0 var(--bs-pad)', textAlign: 'center', whiteSpace: 'nowrap' }
  const first: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, padding: '0 6px 0 var(--bs-pad-first)' }
  const rows = expanded ? group.rows : group.rows.slice(0, COLLAPSED_ROWS)
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="pronos-bs-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: `calc(var(--bs-first) + ${group.labels.length} * var(--bs-col))`, fontFamily: UI_FONT, color: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: 36, color: 'rgba(255,255,255,.55)', fontWeight: 800, fontSize: 12 }}>
            <div style={{ ...first, background: BS_BG, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.9)', height: '100%', display: 'flex', alignItems: 'center' }}>{group.title}</div>
            {group.labels.map(l => <div key={l} style={cell}>{l}</div>)}
          </div>
          {rows.map((r, i) => {
            const bg = i % 2 === 0 ? 'rgba(255,255,255,.05)' : 'transparent'
            const posColor = (r.pos && POS_COLORS[r.pos]) || 'rgba(255,255,255,.55)'
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', minHeight: 'var(--bs-row)', background: bg }}>
                <div style={{ ...first, background: i % 2 === 0 ? '#111b3e' : BS_BG, height: '100%', display: 'flex', alignItems: 'center', gap: 'var(--bs-gap)' }}>
                  <Avatar src={r.headshot} name={r.name} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--bs-name)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'var(--bs-name-w)' }}>{r.name}</div>
                    <div style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'rgba(255,255,255,.55)' }}>
                      {r.pos && <span style={{ color: posColor }}>{r.pos}</span>}
                      {r.pos && abbr ? ' • ' : ''}{abbr}
                      {r.note ? <span style={{ marginLeft: 4 }}>{r.note}</span> : null}
                    </div>
                  </div>
                </div>
                {r.stats.map((v, j) => <div key={j} style={{ ...cell, fontSize: 'var(--bs-fs)', fontWeight: 600 }}>{v}</div>)}
              </div>
            )
          })}
          {group.totals && (expanded || group.rows.length <= COLLAPSED_ROWS) && (
            <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', minHeight: 44, borderTop: '2px solid rgba(255,255,255,.22)', fontWeight: 800 }}>
              <div style={{ ...first, background: BS_BG, height: '100%', display: 'flex', alignItems: 'center', fontSize: 13 }}>Équipe</div>
              {group.totals.map((v, j) => <div key={j} style={{ ...cell, fontSize: 'var(--bs-fs)' }}>{v}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BoxScorePanel({ m, pick }: { m: ApiMatch; pick?: Pick }) {
  const [box, setBox] = useState<BoxScoreData | null>(null)
  const [error, setError] = useState<'unavailable' | 'failed' | null>(null)
  const [side, setSide] = useState<'left' | 'right'>(pick === 'right' ? 'right' : 'left')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/pronos/boxscore?id=${encodeURIComponent(m.id)}`)
      .then(async r => {
        if (cancelled) return
        if (r.status === 404) return setError('unavailable')
        if (!r.ok) return setError('failed')
        setBox(await r.json())
      })
      .catch(() => { if (!cancelled) setError('failed') })
    return () => { cancelled = true }
  }, [m.id])

  const teams = { left: getTeamById(m.leftId), right: getTeamById(m.rightId) }
  const short = (n?: string) => (n ? n.split(' ').slice(-1)[0].toUpperCase() : '')
  const current = box?.teams.find(t => t.side === side)
  const hasMore = !!current?.groups.some(g => g.rows.length > COLLAPSED_ROWS)
  const info: React.CSSProperties = { fontFamily: UI_FONT, fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,.6)', padding: '10px 0 16px' }

  return (
    <div style={{ background: BS_BG, padding: '16px 12px 8px' }}>
      <PickSummary m={m} pick={pick} />
      {!box && !error && <div style={info}>Chargement du box score…</div>}
      {error === 'unavailable' && <div style={info}>Box score indisponible pour ce match.</div>}
      {error === 'failed' && <div style={info}>Impossible de charger le box score. Réessaie dans un instant.</div>}
      {box && box.teams.length === 0 && <div style={info}>Pas encore de statistiques pour ce match.</div>}
      {box && box.teams.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, padding: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)', marginBottom: 14 }}>
            {(['left', 'right'] as const).map(s => {
              const t = teams[s]
              return (
                <button key={s} type="button" onClick={() => { setSide(s); setExpanded(false) }} aria-pressed={side === s}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 6px', borderRadius: 999,
                    border: 'none', cursor: 'pointer', fontFamily: UI_FONT, fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
                    background: side === s ? '#fff' : 'transparent', color: side === s ? NAVY : 'rgba(255,255,255,.7)',
                  }}>
                  {t && <TeamBadge teamId={t.id} size={22} />}
                  {short(t?.name)}
                </button>
              )
            })}
          </div>
          {current && current.groups.length > 0
            ? current.groups.map((g, i) => <BoxGroupTable key={i} group={g} abbr={current.abbr} expanded={expanded} />)
            : <div style={info}>Pas de statistiques individuelles pour cette équipe.</div>}
          {hasMore && (
            <div style={{ textAlign: 'center', margin: '4px 0 14px' }}>
              <button type="button" onClick={() => setExpanded(e => !e)}
                style={{
                  padding: '9px 22px', borderRadius: 999, background: 'transparent', cursor: 'pointer',
                  border: '1px solid rgba(141,182,255,.55)', color: '#8db6ff', fontFamily: UI_FONT, fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
                }}>
                {expanded ? 'MONTRER MOINS' : 'MONTRER PLUS'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MatchItem({ m, pick, onPick }: { m: ApiMatch; pick?: Pick; onPick: (id: string, side: Pick) => void }) {
  const [open, setOpen] = useState(false)
  // Pas de box score pour un match pas encore commencé (rien à montrer), ni
  // pour le football (aucune source gratuite branchée).
  const hasBox = m.locked && m.sport !== 'football'
  return (
    <>
      <MatchRow m={m} pick={pick} onPick={onPick} />
      {hasBox && (
        <>
          <button type="button" className="pronos-bs-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {open ? 'Masquer le box score' : 'Box score'}
          </button>
          {open && <BoxScorePanel m={m} pick={pick} />}
        </>
      )}
    </>
  )
}

// Tous les cadres sont collés (un seul bloc, pas d'espace entre les
// matchs) : un seul bord blanc autour de la liste, un simple filet entre
// chaque ligne.
function MatchList({ matches, picks, onPick }: { matches: ApiMatch[]; picks: Record<string, Pick>; onPick: (id: string, side: Pick) => void }) {
  return (
    <div style={{ border: '4px solid #fff', borderRadius: 0, overflow: 'hidden' }}>
      {matches.map((m, i) => (
        <div key={m.id} style={{ borderTop: i > 0 ? '2px solid #fff' : 'none' }}>
          <MatchItem m={m} pick={picks[m.id]} onPick={onPick} />
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
.pronos-draw { margin-top: 6px; padding: 4px 14px; border: 0; border-radius: 999px; font: 800 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: .5px; }
.pronos-vs-circle { width: 34px; height: 34px; margin: 5px 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; }

.pronos-bs-scroll { --bs-first: 158px; --bs-col: 52px; --bs-av: 40px; --bs-pad: 6px; --bs-pad-first: 10px; --bs-gap: 10px; --bs-row: 56px; --bs-name: 14px; --bs-name-w: 96px; --bs-fs: 14px; }
@media (max-width: 680px) { .pronos-bs-scroll { --bs-first: 108px; --bs-col: 34px; --bs-av: 26px; --bs-pad: 2px; --bs-pad-first: 6px; --bs-gap: 6px; --bs-row: 42px; --bs-name: 12px; --bs-name-w: 66px; --bs-fs: 12.5px; } }
.pronos-bs-toggle { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 7px 0; border: 0; cursor: pointer; background: rgba(255,255,255,.07); color: #fff; font: 800 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: .3px; }
.pronos-bs-toggle:hover { background: rgba(255,255,255,.13); }

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
  .pronos-draw { margin-top: 0; }
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
  // Semaine courante du lundi au dimanche (jours passés inclus, avec leurs résultats) ;
  // la semaine précédente se charge à la demande (bouton « résultats de la semaine dernière »).
  const [days, setDays] = useState<string[]>(() => daysForOffsets(weekOffsets(0)).map(d => d.label))
  const [activeDay, setActiveDay] = useState(() => dayLabel(new Date()))
  const [week, setWeek] = useState<'current' | 'prev'>('current')
  const [prev, setPrev] = useState<{ matches: ApiMatch[]; days: string[] } | null>(null)
  const [prevLoading, setPrevLoading] = useState(false)
  const [activeSport, setActiveSport] = useState<Sport | 'ALL'>('ALL')
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [xpGain, setXpGain] = useState<{ wins: number; xp: number } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/pronos/matches')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setMatches(data.matches ?? [])
        if (data.days?.length) setDays(data.days)
      })
      .catch(() => { if (!cancelled) setMatches([]) })
    return () => { cancelled = true }
  }, [user])

  // Charge les picks déjà enregistrés pour cet utilisateur -- sans ça ils
  // disparaissaient au refresh (uniquement en state local avant).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.from('pronos_picks').select('match_id, pick').eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled || !data) return
        const map: Record<string, Pick> = {}
        for (const row of data) map[row.match_id] = row.pick as Pick
        setPicks(map)
      })
    return () => { cancelled = true }
  }, [user])

  // Verse l'XP des bons pronos des matchs terminés (route idempotente, le
  // calcul est fait côté serveur) -- au chargement, une fois les picks lus.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch('/api/pronos/resolve', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(res => { if (!cancelled && res?.awarded > 0) setXpGain({ wins: res.awarded, xp: res.xp }) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [user])

  // Pas connecté -- module masqué, aucun appel supplémentaire.
  if (!user) return null

  // Écriture via la route serveur (qui refuse un match déjà commencé) ;
  // mise à jour optimiste, annulée si le serveur refuse.
  const handlePick = async (id: string, side: Pick) => {
    const previous = picks[id]
    const cancel = previous === side
    setPicks(p => ({ ...p, [id]: cancel ? (undefined as any) : side }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/pronos/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ matchId: id, pick: cancel ? null : side }),
      })
      if (!res.ok) throw new Error('pick refused')
    } catch {
      setPicks(p => ({ ...p, [id]: previous as any }))
    }
  }

  const showPrev = async () => {
    setWeek('prev')
    const lastDay = (prev?.days ?? daysForOffsets(weekOffsets(-1)).map(d => d.label)).slice(-1)[0]
    setActiveDay(lastDay)
    if (prev || prevLoading) return
    setPrevLoading(true)
    try {
      const data = await fetch('/api/pronos/matches?week=prev').then(r => r.json())
      setPrev({ matches: data.matches ?? [], days: data.days ?? [] })
    } catch { setPrev({ matches: [], days: [] }) }
    setPrevLoading(false)
  }
  const showCurrent = () => { setWeek('current'); setActiveDay(dayLabel(new Date())) }

  const shownDays = week === 'prev' ? (prev?.days?.length ? prev.days : daysForOffsets(weekOffsets(-1)).map(d => d.label)) : days
  const shownMatches = week === 'prev' ? prev?.matches ?? null : matches
  const visible = (shownMatches ?? []).filter(m => m.day === activeDay && (activeSport === 'ALL' || m.sport === activeSport))

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

        {xpGain && (
          <p style={{ fontFamily: UI_FONT, fontWeight: 800, fontSize: 14, color: GREEN, margin: '-8px 0 16px' }}>
            +{xpGain.xp} XP — {xpGain.wins} bon{xpGain.wins > 1 ? 's' : ''} prono{xpGain.wins > 1 ? 's' : ''} sur des matchs terminés !
          </p>
        )}

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

        {/* Sélecteur de jour (lundi → dimanche) */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 20 }}>
          {shownDays.map(d => (
            <button key={d} onClick={() => setActiveDay(d)} style={{
              ...pillBase,
              background: d === activeDay ? '#fff' : 'rgba(255,255,255,.08)',
              color: d === activeDay ? NAVY : '#fff',
            }}>
              {d}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          {week === 'current' ? (
            <button type="button" onClick={showPrev}
              style={{ ...pillBase, padding: '7px 14px', fontSize: 13, background: 'transparent', color: '#8db6ff', border: '1px solid rgba(141,182,255,.55)' }}>
              ← Résultats de la semaine dernière
            </button>
          ) : (
            <button type="button" onClick={showCurrent}
              style={{ ...pillBase, padding: '7px 14px', fontSize: 13, background: 'transparent', color: '#8db6ff', border: '1px solid rgba(141,182,255,.55)' }}>
              Revenir à cette semaine →
            </button>
          )}
        </div>

        {shownMatches === null ? (
          <p style={{ fontFamily: UI_FONT, fontWeight: 600, color: 'rgba(255,255,255,.6)', fontSize: 16, textAlign: 'center', padding: '40px 0' }}>
            {week === 'prev' && prevLoading ? 'Chargement des résultats...' : 'Chargement des matchs...'}
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
