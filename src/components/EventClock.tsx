'use client'
import { useEffect, useState } from 'react'

// Compte a rebours "shot clock" du prochain evenement (les evenements n'ont qu'une date, sans heure : on compte jusqu'a 00:00 ce jour-la).
export default function EventClock({ title, date }: { title: string; date: string }) {
  const target = new Date(`${date}T00:00:00`).getTime()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (now === null) return null
  const left = Math.max(0, Math.floor((target - now) / 1000))
  // l'evenement a lieu aujourd'hui (la date n'a pas d'heure) : pas de zeros, un message
  const t0 = new Date(now); const todayKey = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`
  if (left === 0 && date === todayKey) {
    return (
      <div className="sc-wrap">
        <div className="sc">
          <div className="sc-ev">{title}</div>
          <div className="sc-dg"><span className="sc-v da-display" style={{ fontSize: 'clamp(34px, 9vw, 64px)', letterSpacing: '.04em' }}>C&apos;est aujourd&apos;hui</span></div>
        </div>
      </div>
    )
  }
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), s = left % 60
  const two = (n: number) => String(n).padStart(2, '0')
  const units: [number, string][] = [[d, 'Jours'], [h, 'Heures'], [m, 'Min'], [s, 'Sec']]
  return (
    <div className="sc-wrap">
      <div className="sc">
        <div className="sc-ev">{title}</div>
        <div className="sc-dg" aria-label={`${d} jours ${h} heures ${m} minutes`}>
          {units.map(([v, l], i) => (
            <div className="sc-u" key={l}>
              {i > 0 && <span className="sc-sep da-display">:</span>}
              <div><span className="sc-v da-display">{two(v)}</span><div className="sc-l">{l}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
