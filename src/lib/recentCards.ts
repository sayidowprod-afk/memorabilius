// Dernières cartes ouvertes (gardées sur l'appareil uniquement, rien n'est envoyé au serveur).
export type RecentCard = { img: string; name: string; set: string; href: string }
const KEY = 'mb_recent_cards'
const MAX = 10

export function readRecentCards(): RecentCard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(x => x && typeof x.img === 'string' && typeof x.href === 'string').slice(0, MAX) : []
  } catch { return [] }
}

export function addRecentCard(c: RecentCard) {
  try {
    const list = [c, ...readRecentCards().filter(x => x.href !== c.href)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* stockage indisponible : on ignore */ }
}

export function clearRecentCards() {
  try { localStorage.removeItem(KEY) } catch { /* rien */ }
}
