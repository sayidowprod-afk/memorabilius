// Fiche officielle NBA.com des joueurs (liste https://www.nba.com/players) : pays,
// gabarit, universite, draft. Une seule page (~600 Ko) pour tous les joueurs --
// mise en cache en memoire (par instance serverless) pour ne pas la retelecharger
// a chaque fiche. Tout est best-effort : null si NBA.com est injoignable.

export interface NbaComPlayer {
  name: string
  country: string | null
  height: string | null          // "6-8"
  weight: string | null          // lb
  college: string | null
  draftYear: number | null
  draftRound: number | null
  draftNumber: number | null
  fromYear: number | null        // premiere saison NBA
  position: string | null
  team: string | null
}

let cache: { at: number; players: NbaComPlayer[] } | null = null
const TTL = 12 * 3600 * 1000

export const nbaKey = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/ (jr|sr|ii|iii|iv)$/, '').replace(/ /g, '')

const toNum = (v: unknown) => { const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : null }

async function loadPlayers(): Promise<NbaComPlayer[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.players
  try {
    const res = await fetch('https://www.nba.com/players', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return cache?.players ?? []
    const html = await res.text()
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!m) return cache?.players ?? []
    const raw: any[] = JSON.parse(m[1])?.props?.pageProps?.players ?? []
    const players = raw.map(p => ({
      name: `${p.PLAYER_FIRST_NAME} ${p.PLAYER_LAST_NAME}`.trim(),
      country: p.COUNTRY || null,
      height: p.HEIGHT || null,
      weight: p.WEIGHT || null,
      college: p.COLLEGE || null,
      draftYear: toNum(p.DRAFT_YEAR), draftRound: toNum(p.DRAFT_ROUND), draftNumber: toNum(p.DRAFT_NUMBER),
      fromYear: toNum(p.FROM_YEAR),
      position: p.POSITION || null,
      team: p.TEAM_ABBREVIATION || null,
    }))
    if (players.length) cache = { at: Date.now(), players }
    return players
  } catch {
    return cache?.players ?? []
  }
}

export async function findNbaComPlayer(name: string): Promise<NbaComPlayer | null> {
  const players = await loadPlayers()
  if (!players.length) return null
  const key = nbaKey(name)
  const hits = players.filter(p => nbaKey(p.name) === key)
  // Homonymes (ex: deux "Jaylin Williams") : on garde le plus recent.
  return hits.sort((a, b) => (b.fromYear ?? 0) - (a.fromYear ?? 0))[0] ?? null
}

// "6-8" -> "2,03 m" ; "243" (lb) -> "110 kg"
export function heightMeters(h: string | null): string | null {
  const m = h?.match(/^(\d+)-(\d+)$/)
  if (!m) return null
  const inches = parseInt(m[1], 10) * 12 + parseInt(m[2], 10)
  return `${(inches * 0.0254).toFixed(2).replace('.', ',')} m`
}
export function weightKg(w: string | null): string | null {
  const n = parseInt(w ?? '', 10)
  return Number.isFinite(n) && n > 0 ? `${Math.round(n * 0.4536)} kg` : null
}
