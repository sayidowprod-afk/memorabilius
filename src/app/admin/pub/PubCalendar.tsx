'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PUB_SLOTS } from '@/lib/pubSlots'

// 939 · Calendrier de publication : la semaine en cours, chaque créneau conseillé (voir « Quand publier ») avec son état.
// Clic sur une case = état suivant : à faire → vidéo prête → publié → sauté → vide.
type Status = 'planned' | 'ready' | 'posted' | 'skipped'
const ORDER: (Status | 'none')[] = ['none', 'planned', 'ready', 'posted', 'skipped']
const LABEL: Record<Status | 'none', { t: string; bg: string }> = {
  none: { t: '·', bg: 'transparent' },
  planned: { t: 'À faire', bg: '#7a5b00' },
  ready: { t: 'Prête', bg: '#2f6bff' },
  posted: { t: 'Publié ✓', bg: '#1e9e57' },
  skipped: { t: 'Sauté', bg: '#555' },
}
const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

export default function PubCalendar() {
  const [offset, setOffset] = useState(0)                      // semaines par rapport à la semaine en cours
  const [map, setMap] = useState<Record<string, Status>>({})
  const [err, setErr] = useState('')
  const monday = new Date(); monday.setHours(12, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  const from = iso(days[0]), to = iso(days[6])

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''
  const load = useCallback(async () => {
    setErr('')
    const r = await fetch('/api/admin/pub-calendar?from=' + from + '&to=' + to, { headers: { Authorization: 'Bearer ' + await token() } })
    if (!r.ok) { setErr('Calendrier indisponible (la migration SQL est-elle appliquée ?).'); setMap({}); return }
    const rows = await r.json() as { day: string; slot: string; status: Status }[]
    setMap(Object.fromEntries(rows.map(x => [x.day + '|' + x.slot, x.status])))
  }, [from, to])
  useEffect(() => { load() }, [load])

  const cycle = async (day: string, slot: string) => {
    const cur = (map[day + '|' + slot] || 'none') as Status | 'none'
    const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]
    setMap(m => { const n = { ...m }; if (next === 'none') delete n[day + '|' + slot]; else n[day + '|' + slot] = next; return n })
    const r = await fetch('/api/admin/pub-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() }, body: JSON.stringify({ day, slot, status: next }) })
    if (!r.ok) { setErr('Enregistrement impossible.'); load() }
  }

  const today = iso(new Date())
  const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', fontSize: 12, fontWeight: 800, borderBottom: '2px solid var(--border, #243063)', whiteSpace: 'nowrap' }
  return (
    <section style={{ border: '2px solid var(--border, #243063)', padding: 14, margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <b style={{ fontSize: 16, flex: 1 }}>🗓 Calendrier de publication</b>
        <button type="button" onClick={() => setOffset(o => o - 1)} style={{ padding: '4px 10px', cursor: 'pointer' }} aria-label="Semaine précédente">←</button>
        <span style={{ fontSize: 13 }}>{days[0].getDate()}/{days[0].getMonth() + 1} – {days[6].getDate()}/{days[6].getMonth() + 1}</span>
        <button type="button" onClick={() => setOffset(o => o + 1)} style={{ padding: '4px 10px', cursor: 'pointer' }} aria-label="Semaine suivante">→</button>
      </div>
      {err && <p style={{ color: '#e74c3c', fontSize: 13, margin: '0 0 8px' }}>{err}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Créneau</th>{days.map(d => <th key={iso(d)} style={{ ...th, color: iso(d) === today ? '#2f6bff' : undefined }}>{DAYS[d.getDay()]} {d.getDate()}</th>)}</tr></thead>
          <tbody>
            {PUB_SLOTS.map(sl => (
              <tr key={sl.id}>
                <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border, #243063)' }}>{sl.pays} · {String(sl.hour).padStart(2, '0')} h{sl.min ? String(sl.min).padStart(2, '0') : ''} <span style={{ color: 'var(--text2, #aab3d1)' }}>(FR)</span></td>
                {days.map(d => {
                  const key = iso(d), st = (map[key + '|' + sl.id] || 'none') as Status | 'none'
                  const advised = sl.days.includes(d.getDay())
                  return (
                    <td key={key} style={{ padding: 2, borderBottom: '1px solid var(--border, #243063)', textAlign: 'center' }}>
                      <button type="button" onClick={() => cycle(key, sl.id)} disabled={!advised && st === 'none'} title={advised ? 'Changer l’état' : 'Jour non conseillé pour ce créneau'}
                        style={{ width: '100%', minWidth: 62, padding: '4px 2px', border: advised ? '1px solid var(--border, #243063)' : '1px dashed transparent', background: LABEL[st].bg, color: st === 'none' ? 'var(--text2, #aab3d1)' : '#fff', fontSize: 11, fontWeight: 700, cursor: advised || st !== 'none' ? 'pointer' : 'default', opacity: advised || st !== 'none' ? 1 : .25 }}>
                        {advised && st === 'none' ? '○' : LABEL[st].t}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text2, #aab3d1)', margin: '8px 0 0' }}>○ = jour conseillé. Un clic fait passer à l’état suivant : à faire, prête, publié, sauté.</p>
    </section>
  )
}
