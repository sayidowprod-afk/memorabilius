import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabaseServer'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Calendrier des sorties de cartes basket | Memorabilius',
  description: 'Les prochaines sorties de produits de cartes de basket (Panini, Topps…), mises à jour automatiquement chaque semaine.',
  alternates: { canonical: '/sorties' },
}

type Row = { name: string; release_date: string; formats: string[] | null; source_url: string | null; set_id?: number | null }

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function relative(iso: string, today: Date): string {
  const d = new Date(iso + 'T00:00:00Z').getTime()
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const n = Math.round((d - t) / 86400000)
  if (n === 0) return 'Aujourd’hui'
  if (n === 1) return 'Demain'
  if (n > 1) return `Dans ${n} jours`
  if (n === -1) return 'Hier'
  return `Il y a ${-n} jours`
}

export default async function SortiesPage() {
  const supabase = createServerClient()
  const today = new Date()
  const from = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  let res = (await supabase.from('card_releases').select('name, release_date, formats, source_url, set_id').gte('release_date', from).order('release_date').limit(200)) as { data: Row[] | null; error: unknown }
  // colonne set_id pas encore créée (migration) : on affiche quand même le calendrier, sans bouton checklist
  if (res.error) res = (await supabase.from('card_releases').select('name, release_date, formats, source_url').gte('release_date', from).order('release_date').limit(200)) as { data: Row[] | null; error: unknown }
  const rows: Row[] = res.error ? [] : (res.data ?? [])

  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const [y, m] = r.release_date.split('-')
    const key = `${y}-${m}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px' }}>
      <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.75rem)', margin: '0 0 6px' }}>Sorties de cartes</h1>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 8px' }}>Les prochaines sorties de produits de basket (Panini, Topps…), mises à jour automatiquement chaque semaine.</p>
      <div style={{ margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <a href="/api/sorties/ics" className="btn-main btn-secondary" style={{ padding: '10px 16px', fontSize: 13 }}>📅 Ajouter à mon agenda</a>
        <span style={{ fontSize: 13, color: 'var(--text2, #666)', flex: '1 1 180px' }}>L’agenda se met à jour tout seul.</span>
      </div>

      {rows.length === 0 && (
        <div style={{ border: '2px dashed var(--border, #243063)', padding: 24, textAlign: 'center' }}>
          <b>Calendrier en cours de remplissage</b>
          <div style={{ color: 'var(--text2, #666)', marginTop: 4 }}>Les premières sorties arrivent après la prochaine mise à jour hebdomadaire.</div>
        </div>
      )}

      {[...groups.entries()].map(([key, list]) => {
        const [y, m] = key.split('-')
        return (
          <section key={key} style={{ marginBottom: 26 }}>
            <h2 style={{ fontFamily: "'Surfquest', Impact, sans-serif", fontWeight: 400, textTransform: 'uppercase', fontSize: 28, margin: '0 0 10px', paddingBottom: 6, borderBottom: '3px solid var(--accent, #003da6)' }}>{MOIS[Number(m) - 1]} {y}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {list.map(r => {
                const day = Number(r.release_date.slice(8, 10))
                const rel = relative(r.release_date, today)
                const past = rel.startsWith('Il y a') || rel === 'Hier'
                return (
                  <div key={r.name + r.release_date} style={{ display: 'flex', gap: 14, alignItems: 'center', border: '2px solid var(--border, #243063)', background: 'var(--card-bg, transparent)', padding: '12px 14px', opacity: past ? 0.65 : 1 }}>
                    <div style={{ textAlign: 'center', minWidth: 52 }}>
                      <div style={{ fontFamily: "'Surfquest', Impact, sans-serif", fontSize: 34, lineHeight: 1 }}>{day}</div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text2, #666)' }}>{MOIS[Number(m) - 1].slice(0, 4)}.</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, overflowWrap: 'anywhere' }}>{r.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text2, #666)', marginTop: 2 }}>
                        <span style={{ fontWeight: 700, color: past ? undefined : '#3ddc97' }}>{rel}</span>
                        {r.formats && r.formats.length > 0 && <> · {r.formats.join(' · ')}</>}
                      </div>
                    </div>
                    {r.set_id && <Link href={`/setlist/${r.set_id}`} style={{ fontSize: 13, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Checklist →</Link>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <p style={{ fontSize: 12, color: 'var(--text2, #666)', marginTop: 20 }}>Les dates sont celles annoncées par les fabricants et peuvent changer. Source : <a href="https://cardsmithsbreaks.com/release-calendar/basketball/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Cardsmith’s Breaks</a>. Retour à l’<Link href="/" style={{ textDecoration: 'underline' }}>accueil</Link>.</p>
    </main>
  )
}
