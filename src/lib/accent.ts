// Couleur d'accent du site, au choix (réglages). « Bleu » = la couleur actuelle (aucun réglage appliqué).
export type AccentChoice = { id: string; label: string; color: string | null }
export const ACCENTS: AccentChoice[] = [
  { id: 'bleu', label: 'Bleu (actuel)', color: null },
  { id: 'vert', label: 'Vert', color: '#1f9d55' },
  { id: 'rouge', label: 'Rouge', color: '#c0262d' },
  { id: 'violet', label: 'Violet', color: '#7a3fd0' },
  { id: 'orange', label: 'Orange', color: '#d97706' },
]
const KEY = 'mb_accent'

export function getAccent(): string | null {
  try { const v = localStorage.getItem(KEY); return v && /^#[0-9a-f]{6}$/i.test(v) ? v : null } catch { return null }
}

export function applyAccent(color: string | null) {
  const el = document.documentElement
  if (color) { el.style.setProperty('--accent', color); el.setAttribute('data-accent', '1') }
  else { el.style.removeProperty('--accent'); el.removeAttribute('data-accent') }
  try { if (color) localStorage.setItem(KEY, color); else localStorage.removeItem(KEY) } catch { /* stockage indisponible */ }
}
