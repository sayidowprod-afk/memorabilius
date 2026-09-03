const MAX_CSV_BYTES = 5 * 1024 * 1024

// Seuls les exports Google Sheets sont autorisés — bloque le SSRF vers les endpoints internes
export function isAllowedCsvUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (
      u.hostname === 'docs.google.com' ||
      u.hostname === 'sheets.googleapis.com'
    )
  } catch { return false }
}

async function fetchCsvOnce(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init ?? { cache: 'no-store' })
    if (!res.ok || !res.body) return res.ok ? await res.text() : null

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_CSV_BYTES) { reader.cancel(); return null }
      chunks.push(value)
    }
    return new TextDecoder('utf-8').decode(
      chunks.reduce((acc, c) => { const merged = new Uint8Array(acc.length + c.length); merged.set(acc); merged.set(c, acc.length); return merged }, new Uint8Array(0))
    )
  } catch {
    return null
  }
}

// Un seul retry sur echec -- Google Sheets repond parfois mal (429/hoquet reseau)
// quand beaucoup de profils sont recalcules en parallele (voir recalcul-stats),
// et un CSV en echec ne doit jamais etre confondu avec "pas de CSV" par l'appelant.
export async function fetchCsvCapped(url: string, init?: RequestInit): Promise<string | null> {
  const first = await fetchCsvOnce(url, init)
  if (first) return first
  await new Promise(r => setTimeout(r, 500))
  return fetchCsvOnce(url, init)
}

export interface CardStats { total: number; rc: number; auto: number; num: number; patch: number }

export function parseCardStats(text: string): CardStats {
  const stats: CardStats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }
  const lines = text.split(/\r?\n/).slice(4)
  for (const line of lines) {
    // Split conscient des guillemets (même regex que GalerieClient/expo) — un
    // simple split(',') décalait toutes les colonnes suivantes dès qu'un champ
    // contenait une virgule (ex: variation "Blue, Refractor"), faussant
    // silencieusement le comptage RC/AUTO/PATCH/NUM pour cette ligne.
    const c = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    if (!c[0] || !c[0].includes('http')) continue
    stats.total++
    if (c[10]?.toLowerCase().includes('oui')) stats.rc++
    if (c[9]?.toLowerCase().includes('oui')) stats.auto++
    if (c[11]?.toLowerCase().includes('oui')) stats.patch++
    if (c[8]?.trim()) stats.num++
  }
  return stats
}
