'use client'
// Encadré « Prochaines sorties » (cartes de basket) : les 4 prochaines dates, avec un lien vers le calendrier complet.
// Ne s'affiche pas tant que le calendrier est vide ou indisponible.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Row = { name: string; release_date: string; formats: string[] | null }

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function relative(iso: string): string {
  const now = new Date()
  const t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const n = Math.round((new Date(iso + 'T00:00:00Z').getTime() - t) / 86400000)
  if (n === 0) return 'Aujourd’hui'
  if (n === 1) return 'Demain'
  return `Dans ${n} jours`
}

export default function UpcomingReleases() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let alive = true
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('card_releases').select('name, release_date, formats').gte('release_date', today).order('release_date').limit(4)
      .then(({ data, error }) => { if (alive) setRows(error ? [] : (data as Row[] | null) ?? []) })
    return () => { alive = false }
  }, [])

  if (!rows || rows.length === 0) return null
  return (
    <section className="da-sortbloc" aria-label="Prochaines sorties de cartes">
      <div className="da-sortbloc-head">
        <h2>📅 Prochaines sorties</h2>
        <Link href="/sorties">Tout le calendrier →</Link>
      </div>
      {rows.map(r => {
        const d = new Date(r.release_date + 'T00:00:00Z')
        return (
          <div key={r.name + r.release_date} className="da-sortbloc-row">
            <div className="da-sortbloc-date"><b>{d.getUTCDate()}</b><span>{MOIS[d.getUTCMonth()]}</span></div>
            <div style={{ minWidth: 0 }}>
              <div className="da-sortbloc-name">{r.name}</div>
              <div className="da-sortbloc-sub"><span>{relative(r.release_date)}</span>{r.formats && r.formats.length > 0 ? ` · ${r.formats.join(' · ')}` : ''}</div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
