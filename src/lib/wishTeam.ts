// Équipe d'une wishlist : « 76ers » doit retrouver « Philadelphia 76ers » (et l'inverse), donc comparaison par inclusion sur
// le texte normalisé. Si la wishlist n'a pas d'équipe, tout est accepté ; si elle en a une, la carte doit en avoir une qui correspond.
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function teamOk(cardTeam: string | null | undefined, wishTeam: string | null | undefined): boolean {
  const w = norm(wishTeam || '')
  if (!w) return true
  const c = norm(cardTeam || '')
  return !!c && (c.includes(w) || w.includes(c))
}
