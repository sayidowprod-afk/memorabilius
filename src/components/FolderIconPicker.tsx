'use client'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SPORTS_TEAMS, teamLogoUrl, type Sport } from '@/lib/sportsTeams'

// Génère la liste d'emojis à partir des principaux blocs Unicode → « tous les emojis ».
function buildEmojis(): string[] {
  const ranges: [number, number][] = [
    [0x1f600, 0x1f64f], // émoticônes
    [0x1f900, 0x1f9ff], // symboles supplémentaires (visages, gestes…)
    [0x1f300, 0x1f5ff], // symboles & pictogrammes divers
    [0x1f680, 0x1f6ff], // transport & cartes
    [0x1fa70, 0x1faff], // symboles étendus-A (objets récents)
    [0x2600, 0x26ff],   // symboles divers (météo, sports…)
    [0x2700, 0x27bf],   // dingbats
    [0x1f1e6, 0x1f1ff], // indicateurs régionaux (lettres drapeaux)
  ]
  const out: string[] = []
  for (const [a, b] of ranges) for (let cp = a; cp <= b; cp++) out.push(String.fromCodePoint(cp))
  return out
}

const SPORT_LABELS: Record<Sport, string> = {
  nba: '🏀 NBA', nfl: '🏈 NFL', mlb: '⚾ MLB', nhl: '🏒 NHL', football: '⚽ Foot',
}

export default function FolderIconPicker({ onPick, onClose }: { onPick: (icon: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'emoji' | 'team'>('emoji')
  const [sport, setSport] = useState<Sport>('nba')
  const emojis = useMemo(buildEmojis, [])
  const teams = useMemo(() => SPORTS_TEAMS.filter(t => t.sport === sport), [sport])
  const sports = useMemo(() => [...new Set(SPORTS_TEAMS.map(t => t.sport))] as Sport[], [])

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 18, width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setTab('emoji')} style={tabStyle(tab === 'emoji')}>😀 Emoji</button>
          <button onClick={() => setTab('team')} style={tabStyle(tab === 'team')}>🛡️ Équipe</button>
          <button onClick={() => onPick('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e74c3c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Retirer</button>
        </div>

        {tab === 'emoji' ? (
          <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: 2 }}>
            {emojis.map((e, i) => (
              <button key={i} onClick={() => onPick(e)}
                style={{ fontSize: 22, lineHeight: '38px', height: 38, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={ev => (ev.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}>
                {e}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {sports.map(s => (
                <button key={s} onClick={() => setSport(s)} style={tabStyle(sport === s, true)}>{SPORT_LABELS[s]}</button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 6 }}>
              {teams.map(t => (
                <button key={t.id} onClick={() => onPick(`team:${t.id}`)} title={t.name}
                  style={{ background: '#f8f8f8', border: '1px solid #eee', borderRadius: 8, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52 }}>
                  <img src={teamLogoUrl(t)} alt={t.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function tabStyle(active: boolean, small = false): React.CSSProperties {
  return {
    padding: small ? '5px 10px' : '7px 14px', borderRadius: 10, cursor: 'pointer',
    fontSize: small ? 12 : 13, fontWeight: 700,
    border: active ? '2px solid #003DA6' : '2px solid #e0e0e0',
    background: active ? '#003DA6' : 'white', color: active ? 'white' : '#333',
  }
}
