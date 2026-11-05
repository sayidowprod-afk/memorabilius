import { createServerClient } from '@/lib/supabaseServer'

export const revalidate = 3600

// Agenda (.ics) des sorties de cartes de basket : à ajouter une fois à l'agenda du téléphone, il se met ensuite à jour tout seul.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const ymd = (iso: string) => iso.replace(/-/g, '')

export async function GET() {
  const supabase = createServerClient()
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const { data } = await supabase.from('card_releases').select('name, release_date, formats, source_url').gte('release_date', from).order('release_date').limit(300)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memorabilius//Sorties de cartes//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Sorties de cartes (Memorabilius)', 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D']
  for (const r of data ?? []) {
    const end = new Date(new Date(r.release_date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
    const uid = `${ymd(r.release_date)}-${Buffer.from(r.name).toString('hex').slice(0, 40)}@memorabilius.fr`
    const desc = [(r.formats ?? []).join(' · '), 'Les dates peuvent changer.', r.source_url ?? ''].filter(Boolean).join('\n')
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(r.release_date)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${esc('🃏 ' + r.name)}`, `DESCRIPTION:${esc(desc)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="sorties-cartes.ics"', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}
