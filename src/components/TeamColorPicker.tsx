'use client'
import { useState } from 'react'
import { SPORTS_TEAMS, SPORT_LABELS, teamLogoUrl, type Sport, type SportsTeam } from '@/lib/sportsTeams'

// Palette de couleurs d'equipe : un clic applique la couleur du maillot au profil (en plus du selecteur de couleur libre).
// Chaque pastille montre le logo de l'equipe sur un rond blanc (version couleur, lisible sur n'importe quel fond) ; si le logo est
// introuvable, l'abreviation de l'equipe la remplace. Le nom complet de l'equipe choisie s'affiche sous la palette.
const SPORTS: Sport[] = ['nba', 'nfl', 'mlb', 'nhl', 'wnba', 'football']

// texte noir ou blanc selon la luminosite de la couleur de fond
function inkFor(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#06122e' : '#ffffff'
}

function TeamLogo({ t }: { t: SportsTeam }) {
  const [failed, setFailed] = useState(false)
  const src = teamLogoUrl(t, false)
  if (!src || failed) return <>{t.abbr}</>
  return (
    <span className="tcp-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" width={22} height={22} onError={() => setFailed(true)} />
    </span>
  )
}

export default function TeamColorPicker({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  const [sport, setSport] = useState<Sport>('nba')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const teams = SPORTS_TEAMS.filter(t => t.sport === sport)
  const picked = SPORTS_TEAMS.find(t => t.id === pickedId)
  return (
    <div className="tcp">
      <div className="tcp-sports">
        {SPORTS.map(s => <button type="button" key={s} className={s === sport ? 'on' : ''} onClick={() => setSport(s)}>{SPORT_LABELS[s]}</button>)}
      </div>
      <div className="tcp-grid">
        {teams.map(t => (
          <button type="button" key={t.id} title={t.name} aria-label={t.name} className={pickedId === t.id ? 'on' : ''}
            style={{ background: t.color, color: inkFor(t.color) }}
            onClick={() => { setPickedId(t.id); onPick(t.color) }}>
            <TeamLogo t={t} />
          </button>
        ))}
      </div>
      <div className="tcp-name">
        {picked
          ? <><i style={{ background: picked.color }} /> <b>{picked.name}</b> <span>{picked.color}</span></>
          : <span>Touche une pastille : le nom de l&apos;équipe s&apos;affiche ici</span>}
      </div>
    </div>
  )
}
