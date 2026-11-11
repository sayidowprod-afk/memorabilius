// Liste de deck : lecture d'une liste collée (« 4 Dracaufeu ex », « 4x Lightning Bolt (M10) 146 »…) et comparaison avec les cartes de la galerie.
export interface DeckLine { qty: number; name: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function parseDeck(text: string): DeckLine[] {
  const out = new Map<string, DeckLine>()
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.trim()
    if (!l || /^(\/\/|#)/.test(l)) continue
    if (/^(deck|sideboard|maindeck|main|side|commander|pok[eé]mon|dresseur|trainer|[eé]nergie|energy|cr[eé]atures?|sorts?|terrains?|lands?|total)\b.*$/i.test(l) && !/^\d/.test(l)) continue
    let qty = 1
    const m = l.match(/^(\d{1,3})\s*x?\s+(.+)$/i) || l.match(/^(.+?)\s+x\s*(\d{1,3})$/i)
    if (m) { if (/^\d/.test(m[1])) { qty = parseInt(m[1]); l = m[2] } else { qty = parseInt(m[2]); l = m[1] } }
    // retire le code d'extension et le numéro : « Lightning Bolt (M10) 146 », « Dracaufeu ex OBF 125 »
    l = l.replace(/\s*\([^)]*\)\s*\d*\s*$/, '').replace(/\s+[A-Z0-9]{2,5}\s+\d{1,3}$/, '').trim()
    if (!l || l.length < 2) continue
    const key = norm(l)
    const cur = out.get(key)
    if (cur) cur.qty += qty; else out.set(key, { qty, name: l })
  }
  return [...out.values()]
}

export interface DeckRow { name: string; need: number; have: number; missing: number }

// owned : nom de la carte → nombre d'exemplaires possédés (somme des quantités)
export function compareDeck(lines: DeckLine[], owned: { nom: string; quantite?: number | null }[]): DeckRow[] {
  const have = new Map<string, number>()
  for (const c of owned) { const k = norm(c.nom || ''); if (k) have.set(k, (have.get(k) || 0) + (c.quantite || 1)) }
  return lines.map(l => {
    const k = norm(l.name)
    let h = have.get(k) || 0
    if (!h) { for (const [ok, n] of have) { if (ok.startsWith(k + ' ') || k.startsWith(ok + ' ')) h += n } }
    return { name: l.name, need: l.qty, have: h, missing: Math.max(0, l.qty - h) }
  })
}
