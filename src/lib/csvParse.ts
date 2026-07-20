// Logique de lecture/analyse du CSV de collection (export Google Sheets), partagée
// entre update-stats, recalcul-stats et csv-stats — auparavant dupliquée 3 fois avec
// des décalages d'en-tête différents (slice(1) vs slice(4)), ce qui faussait le
// comptage selon la route appelée. slice(4) + filtre "http" est la convention
// correcte (alignée sur src/lib/csvCards.ts, qui charge réellement les cartes).

const MAX_CSV_BYTES = 5 * 1024 * 1024 // 5 Mo : largement suffisant pour une collection, évite un fetch illimité

export async function fetchCsvCapped(url: string, init?: RequestInit): Promise<string | null> {
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

export interface CardStats { total: number; rc: number; auto: number; num: number; patch: number }

export function parseCardStats(text: string): CardStats {
  const stats: CardStats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }
  const lines = text.split(/\r?\n/).slice(4)
  for (const line of lines) {
    const c = line.split(',')
    if (!c[0] || !c[0].includes('http')) continue
    stats.total++
    if (c[10]?.toLowerCase().includes('oui')) stats.rc++
    if (c[9]?.toLowerCase().includes('oui')) stats.auto++
    if (c[11]?.toLowerCase().includes('oui')) stats.patch++
    if (c[8]?.trim()) stats.num++
  }
  return stats
}
