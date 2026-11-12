// Brouillons d'offres d'échange : une offre préparée puis fermée sans l'envoyer est gardée sur cet appareil (un brouillon par destinataire) et peut être reprise.
export interface TradeDraft { userId: string; name: string; targetIds: string[]; myIds: string[]; message: string; at: number }
const PREFIX = 'trade-draft-'
const MAX_AGE = 30 * 24 * 3600 * 1000

export function loadDraft(userId: string): TradeDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return null
    const d = JSON.parse(raw) as TradeDraft
    if (!d || Date.now() - d.at > MAX_AGE) { localStorage.removeItem(PREFIX + userId); return null }
    return d
  } catch { return null }
}
export function saveDraft(d: TradeDraft) { try { localStorage.setItem(PREFIX + d.userId, JSON.stringify(d)) } catch { /* stockage plein ou indisponible */ } }
export function clearDraft(userId: string) { try { localStorage.removeItem(PREFIX + userId) } catch { /* rien */ } }
export function listDrafts(): TradeDraft[] {
  const out: TradeDraft[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) { const d = loadDraft(k.slice(PREFIX.length)); if (d) out.push(d) }
    }
  } catch { /* rien */ }
  return out.sort((a, b) => b.at - a.at)
}
