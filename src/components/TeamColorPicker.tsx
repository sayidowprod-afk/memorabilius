'use client'
import { useState } from 'react'
import { SPORTS_TEAMS, SPORT_LABELS, type Sport } from '@/lib/sportsTeams'

// Palette de couleurs d'equipe : un clic applique la couleur du maillot au profil (en plus du selecteur de couleur libre).
const SPORTS: Sport[] = ['nba', 'nfl', 'mlb', 'nhl', 'wnba', 'football']

export default function TeamColorPicker({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  const [sport, setSport] = useState<Sport>('nba')
  const teams = SPORTS_TEAMS.filter(t => t.sport === sport)
  return (
    <div className="tcp">
      <div className="tcp-sports">
        {SPORTS.map(s => <button type="button" key={s} className={s === sport ? 'on' : ''} onClick={() => setSport(s)}>{SPORT_LABELS[s]}</button>)}
      </div>
      <div className="tcp-grid">
        {teams.map(t => (
          <button type="button" key={t.id} title={t.name} aria-label={t.name} className={t.color.toLowerCase() === value.toLowerCase() ? 'on' : ''}
            style={{ background: t.color }} onClick={() => onPick(t.color)} />
        ))}
      </div>
    </div>
  )
}
