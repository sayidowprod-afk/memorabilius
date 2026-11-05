// Lecture du calendrier public des sorties de cartes (basket) et lecture de la table card_releases.
// Source : page « release calendar » de Cardsmith's Breaks (HTML public, une requête par semaine, nom du robot indiqué).
export const SORTIES_SOURCE = { id: 'cardsmithsbreaks', url: 'https://cardsmithsbreaks.com/release-calendar/basketball/' }

export type Sortie = { name: string; date: string; formats: string[]; url: string | null }

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// La page n'indique pas l'année ("Thu Nov 12") : on prend l'année en cours, ou la suivante si la date serait trop loin dans le passé.
function dateFor(month: number, day: number, now: Date): string {
  let y = now.getUTCFullYear()
  const candidate = Date.UTC(y, month, day)
  if (candidate < now.getTime() - 150 * 86400000) y += 1
  return new Date(Date.UTC(y, month, day)).toISOString().slice(0, 10)
}

export function parseSorties(html: string, now = new Date()): Sortie[] {
  const out: Sortie[] = []
  const re = /<div class="name"><a href="([^"]+)">([^<]+)<\/a><\/div>\s*<div class="rmeta">([\s\S]*?)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const [, href, rawName, rawMeta] = m
    const name = decode(rawName)
    const meta = decode(rawMeta.replace(/<[^>]+>/g, ' '))
    const d = meta.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\b/)
    if (!name || !d || MONTHS[d[1]] === undefined) continue
    const day = Number(d[2])
    if (day < 1 || day > 31) continue
    const after = meta.slice((d.index ?? 0) + d[0].length)
    const formats = after.split(/[·•]/).map(x => x.trim()).filter(x => /^(Hobby|Jumbo|Mega|Value|Retail|Blaster|Hanger|FOTL|Cello|Fat Pack|Choice|Breaker)/i.test(x))
    out.push({ name, date: dateFor(MONTHS[d[1]], day, now), formats, url: href.startsWith('http') ? href : null })
  }
  // un même produit peut apparaître deux fois (ex. aujourd'hui et « à venir ») : on garde une ligne par (nom, date)
  const seen = new Set<string>()
  return out.filter(s => { const k = `${s.name}|${s.date}`; if (seen.has(k)) return false; seen.add(k); return true })
}
