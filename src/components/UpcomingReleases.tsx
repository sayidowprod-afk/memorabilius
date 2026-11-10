'use client'
// Encadré « Prochaines sorties » (cartes de basket) : les 4 prochaines dates, avec un lien vers le calendrier complet.
// Ne s'affiche pas tant que le calendrier est vide ou indisponible.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AddToCalendarButton from '@/components/AddToCalendarButton'
import SubscribeCalendarLink from '@/components/SubscribeCalendarLink'
import SetWishlistMatch from '@/components/SetWishlistMatch'
import { releaseEvent } from '@/lib/eventIcs'

type Row = { name: string; release_date: string; formats: string[] | null; source_url?: string | null; set_id?: string | null }

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
    // set_id (lien vers la checklist) : si la colonne n'existe pas encore, on réessaie sans elle
    const q = (cols: string) => supabase.from('card_releases').select(cols).gte('release_date', today).order('release_date').limit(4)
    q('name, release_date, formats, source_url, set_id')
      .then(async ({ data, error }) => {
        if (!error) return data
        const r2 = await q('name, release_date, formats, source_url')
        return r2.error ? [] : r2.data
      })
      .then(data => { if (alive) setRows((data as unknown as Row[] | null) ?? []) })
    return () => { alive = false }
  }, [])

  if (!rows || rows.length === 0) return null
  return (
    <section className="da-sortbloc" aria-label="Prochaines sorties de cartes">
      <div className="da-sortbloc-head">
        <h2>📅 Prochaines sorties</h2>
        <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <SubscribeCalendarLink title="Ajoute toutes les sorties à ton agenda ; il se met ensuite à jour tout seul">📅 Tout ajouter</SubscribeCalendarLink>
          <Link href="/sorties">Tout le calendrier →</Link>
        </span>
      </div>
      {rows.map(r => {
        const d = new Date(r.release_date + 'T00:00:00Z')
        return (
          <div key={r.name + r.release_date} className="da-sortbloc-row">
            <div className="da-sortbloc-date"><b>{d.getUTCDate()}</b><span>{MOIS[d.getUTCMonth()]}</span></div>
            <div style={{ minWidth: 0 }}>
              <div className="da-sortbloc-name">{r.name}</div>
              <div className="da-sortbloc-sub"><span>{relative(r.release_date)}</span>{r.formats && r.formats.length > 0 ? ` · ${r.formats.join(' · ')}` : ''}</div>
              <div className="da-sortbloc-act">
                <AddToCalendarButton className="da-sortbloc-btn" ev={releaseEvent(r)} serverUrl={`/api/sorties/ics/une?date=${r.release_date}&name=${encodeURIComponent(r.name)}`} filename="sortie-cartes.ics">📅 Ajouter</AddToCalendarButton>
                {r.set_id && <Link href={`/setlist/${r.set_id}`}>Checklist →</Link>}
              </div>
              {r.set_id && <SetWishlistMatch setId={r.set_id} className="da-sortbloc-sub" />}
            </div>
          </div>
        )
      })}
    </section>
  )
}
