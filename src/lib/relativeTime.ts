// 273 · Dates relatives, écrites de la même façon partout (« il y a 2 h », « hier », « il y a 3 j »), traduites par le navigateur.
// Au-delà d'une semaine : date courte. La date exacte est donnée par exactDate() (infobulle).
export function relTime(iso: string, locale = 'fr-FR', now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = t - now // négatif = passé
  const abs = Math.abs(diff)
  const MIN = 60_000, H = 3_600_000, D = 86_400_000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (abs < MIN) return rtf.format(0, 'second')
  if (abs < H) return rtf.format(Math.round(diff / MIN), 'minute')
  if (abs < D) return rtf.format(Math.round(diff / H), 'hour')
  if (abs < 7 * D) return rtf.format(Math.round(diff / D), 'day')
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear()
  return new Date(t).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function exactDate(iso: string, locale = 'fr-FR'): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' }) : ''
}

// Séparateur de jour d'une conversation : « Aujourd’hui », « Hier », puis « lundi 3 novembre » (traduits par le navigateur).
export function dayLabel(iso: string, locale = 'fr-FR', now = Date.now()): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(d) - start(new Date(now))) / 86_400_000)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (days === 0 || days === -1) return cap(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day'))
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return cap(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }))
}
export const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
