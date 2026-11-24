'use client'
import { useEffect, useState } from 'react'

// Top 10 de la draft de l'année de la saison affichée (source ESPN, comme le « Top 5 rookies » des pages de set)
const API: Record<string, string> = { nba: 'nba', nfl: 'nfl', hockey: 'nhl', baseball: 'mlb' }
const ini = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function DraftTop({ sport, year }: { sport: string; year: number }) {
  const [picks, setPicks] = useState<{ pick: number; name: string }[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  useEffect(() => {
    setPicks([]); setPhotos({})
    if (!API[sport] || !year) return
    let off = false
    ;(async () => {
      try {
        const d = await fetch(`/api/draft-top?sport=${encodeURIComponent(sport)}&year=${year}&n=10`).then(r => (r.ok ? r.json() : { picks: [] }))
        const list: { pick: number; name: string }[] = Array.isArray(d?.picks) ? d.picks.slice(0, 10) : []
        if (off || !list.length) return
        setPicks(list)
        const p = await fetch('/api/player-photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: list.map(x => x.name), sport: API[sport] }) }).then(r => (r.ok ? r.json() : { photos: {} }))
        if (!off && p?.photos) setPhotos(p.photos)
      } catch { /* pas de top 10 */ }
    })()
    return () => { off = true }
  }, [sport, year])
  if (!picks.length) return null
  return (
    <div className="sl-draft">
      <style>{`
        .sl-draft { margin: 0 0 18px; }
        .sl-draft h3 { margin: 0 0 8px; font: 400 20px 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; letter-spacing: .03em; color: var(--text); }
        .sl-draft h3 small { font: 700 11px system-ui, sans-serif; letter-spacing: .08em; color: var(--text2); margin-left: 8px; }
        .sl-draft-row { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 8px; }
        .sl-draft-c { border: 2px solid var(--text); background: var(--card-bg); min-width: 0; }
        .sl-draft-a { position: relative; aspect-ratio: 4 / 5; background: linear-gradient(160deg, #1b3a8a, #050b22); display: grid; place-items: center; overflow: hidden; color: #fff; font: 800 22px system-ui, sans-serif; }
        .sl-draft-a img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
        .sl-draft-a em { position: absolute; top: 0; left: 0; padding: 2px 7px; background: #ffd54a; color: #111; font: 900 12px system-ui, sans-serif; font-style: normal; }
        .sl-draft-n { padding: 5px 6px; font: 800 11px/1.2 system-ui, sans-serif; color: var(--text); overflow-wrap: anywhere; }
        @media (max-width: 900px) { .sl-draft-row { display: flex; overflow-x: auto; } .sl-draft-c { flex: 0 0 96px; } }
      `}</style>
      <h3>Top 10 draft {year}<small>Les premiers choix</small></h3>
      <div className="sl-draft-row">
        {picks.map(p => (
          <div className="sl-draft-c" key={p.pick}>
            <div className="sl-draft-a">
              {photos[p.name] ? <img src={photos[p.name]} alt={p.name} loading="lazy" /> : <b>{ini(p.name)}</b>}
              <em>#{p.pick}</em>
            </div>
            <div className="sl-draft-n">{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
