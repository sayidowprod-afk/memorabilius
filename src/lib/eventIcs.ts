// « Ajouter au calendrier » d'un événement : le fichier d'agenda (.ics) et le lien Google Agenda.
// Utilisé par la page Événements (téléchargement sur ordinateur, lien Google sur Android) et par /api/evenements/ics (iPhone : le fichier est servi
// depuis une vraie adresse, que Safari propose d'ajouter à l'agenda ; un lien « download » en mémoire ne fait rien sur téléphone).
export type EventLike = {
  id: number | string
  title: string
  description: string | null
  date: string               // AAAA-MM-JJ
  time: string | null        // HH:MM
  end_date: string | null
  city: string
  country: string
  location_name: string | null
}

// Echappement RFC5545 (virgule, point-virgule, retour a la ligne, antislash).
const escapeICS = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n')

const locationOf = (ev: EventLike) => [ev.location_name, ev.city, ev.country].filter(Boolean).join(', ')
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

// Jour suivant (AAAAMMJJ) : en iCal / Google, la date de FIN d'un événement « journée entière » est exclusive.
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return ymd(d)
}

// Sans heure renseignee : DTSTART;VALUE=DATE suffit, pas besoin de fuseau horaire -- s'affiche comme un evenement "journee entiere" dans tous les
// agendas (Google/Apple/Outlook). Avec heure : horaire local flottant (sans Z ni TZID) -- approximation suffisante, l'organisateur et les
// participants d'un meme evenement physique sont presque toujours dans le meme fuseau.
export function buildEventICS(ev: EventLike): string {
  const dt = ev.date.replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const location = locationOf(ev)
  const dtStartLine = ev.time ? `DTSTART:${dt}T${ev.time.replace(':', '')}00` : `DTSTART;VALUE=DATE:${dt}`
  // DTEND : uniquement pour un evenement multi-jours (end_date renseigne et different de date) ; le jour de fin etant exclusif, on ajoute un jour.
  const dtEndLine = ev.end_date && ev.end_date !== ev.date ? `DTEND;VALUE=DATE:${nextDay(ev.end_date)}` : false
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memorabilius//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${ev.id}@memorabilius.fr`,
    `DTSTAMP:${stamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeICS(ev.title)}`,
    location && `LOCATION:${escapeICS(location)}`,
    ev.description && `DESCRIPTION:${escapeICS(ev.description)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n') + '\r\n'
}

// Lien « ajouter à Google Agenda » : s'ouvre dans l'appli Google Agenda sur Android (événement prérempli, il suffit d'enregistrer).
export function googleCalendarUrl(ev: EventLike): string {
  const dt = ev.date.replace(/-/g, '')
  let dates: string
  if (ev.time) {
    const start = new Date(`${ev.date}T${ev.time}:00`)
    const end = new Date(start.getTime() + 2 * 3600000) // durée inconnue : 2 h par défaut
    const hms = (d: Date) => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
    dates = `${hms(start)}/${hms(end)}`
  } else {
    dates = `${dt}/${nextDay(ev.end_date && ev.end_date !== ev.date ? ev.end_date : ev.date)}`
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates })
  const loc = locationOf(ev)
  if (loc) p.set('location', loc)
  if (ev.description) p.set('details', ev.description)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
