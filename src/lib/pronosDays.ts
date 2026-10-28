// Helpers de date/heure pour le module Pronos -- utilisés à la fois côté
// serveur (route API, groupement des matchs par jour FR) et côté client
// (génération des mêmes libellés de jour pour les filtres).

const TZ = 'Europe/Paris'

// "LUN 26" -- même format que les filtres de jour affichés.
export function dayLabel(date: Date): string {
  const wd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: TZ }).format(date)
    .toUpperCase().replace('.', '')
  const d = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: TZ }).format(date)
  return `${wd} ${d}`
}

// "21:30" en heure de Paris.
export function timeLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ, hour12: false }).format(date)
}

// Date calendaire (YYYY-MM-DD) à Paris -- pour choisir quel "jour" de nos
// filtres un match appartient (un match à 02h00 Paris appartient au jour
// calendaire où il a lieu heure locale, pas la date US de la veille).
export function isoDateInParis(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date) // en-CA -> YYYY-MM-DD
}

// Les 7 prochains jours (aujourd'hui inclus), avec le jour calendaire US
// correspondant à interroger côté API (api-sports date par date US/UTC) --
// on interroge la date US du jour ET celle de la veille, pour attraper les
// matchs qui commencent tard US mais tombent le lendemain à Paris.
export function daysForOffsets(offsets: number[]): { label: string; parisDate: string; offset: number }[] {
  const now = new Date()
  return offsets.map(offset => {
    const d = new Date(now.getTime() + offset * 86400000)
    return { label: dayLabel(d), parisDate: isoDateInParis(d), offset }
  })
}

export function nextDays(n: number): { label: string; parisDate: string }[] {
  return daysForOffsets(Array.from({ length: n }, (_, i) => i))
}

// Décalages (en jours par rapport à aujourd'hui, Paris) des 7 jours du lundi au
// dimanche de la semaine courante (weekShift = 0) ou d'une autre (-1 = la semaine
// précédente). Les jours déjà passés de la semaine restent donc affichés.
export function weekOffsets(weekShift = 0): number[] {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ }).format(new Date())
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd) // lundi = 0
  const monday = -(idx < 0 ? 0 : idx) + 7 * weekShift
  return Array.from({ length: 7 }, (_, i) => monday + i)
}

// Décalage d'une date calendaire Paris (YYYY-MM-DD) par rapport à aujourd'hui.
export function offsetFromToday(parisDate: string): number {
  const a = Date.parse(isoDateInParis(new Date()) + 'T12:00:00Z')
  const b = Date.parse(parisDate + 'T12:00:00Z')
  return Math.round((b - a) / 86400000)
}
