// 783 · variantes d'écriture d'un même nom dans une galerie (« Lebron James » / « LeBron James »).
// On ne regroupe QUE ce qui ne diffère que par les majuscules, les accents, la ponctuation et les espaces :
// jamais de « nom ressemblant » (Jalen / Jaylen Williams sont deux joueurs), donc aucun faux rapprochement possible.

export interface VariantCard { id: string; value: string }
export interface VariantGroup {
  key: string
  canonical: string                       // l'écriture proposée : la plus utilisée (à égalité, la mieux « formée »)
  variants: { value: string; ids: string[] }[]   // les autres écritures, avec les cartes modifiables concernées
}

export const nameKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// une écriture « bien formée » : au moins une majuscule ET une minuscule (évite de préférer « LEBRON JAMES » ou « lebron james »)
const wellFormed = (s: string) => /[A-ZÀ-Ý]/.test(s) && /[a-zà-ÿ]/.test(s) ? 1 : 0

/**
 * @param all   toutes les valeurs de la galerie (cartes modifiables ou non) : elles servent à choisir l'écriture la plus utilisée
 * @param mine  les cartes modifiables (id + valeur) : seules celles-ci peuvent être corrigées
 * @param ignored clés que le membre a déclarées « ce sont deux choses différentes »
 */
export function findVariantGroups(all: string[], mine: VariantCard[], ignored: Set<string>): VariantGroup[] {
  const counts = new Map<string, Map<string, number>>()
  for (const raw of all) {
    const v = (raw || '').trim()
    const k = nameKey(v)
    if (k.length < 3) continue
    const m = counts.get(k) || new Map<string, number>()
    m.set(v, (m.get(v) || 0) + 1)
    counts.set(k, m)
  }
  const out: VariantGroup[] = []
  for (const [key, writings] of counts) {
    if (writings.size < 2 || ignored.has(key)) continue
    const canonical = [...writings.entries()].sort((a, b) => b[1] - a[1] || wellFormed(b[0]) - wellFormed(a[0]) || a[0].localeCompare(b[0]))[0][0]
    const byValue = new Map<string, string[]>()
    for (const c of mine) {
      const v = (c.value || '').trim()
      if (nameKey(v) !== key || v === canonical) continue
      byValue.set(v, [...(byValue.get(v) || []), c.id])
    }
    if (!byValue.size) continue   // rien à corriger parmi les cartes que je peux modifier : on n'affiche rien
    out.push({ key, canonical, variants: [...byValue.entries()].map(([value, ids]) => ({ value, ids })) })
  }
  return out.sort((a, b) => a.canonical.localeCompare(b.canonical))
}

// ── Équipes : « Sixers », « Lakers », « LA Lakers » → le nom officiel du site (« Philadelphia 76ers », « Los Angeles Lakers »).
// Un surnom n'est reconnu que s'il désigne UNE seule équipe (« Giants » ou « Kings » existent dans plusieurs sports : on n'y touche pas).
import { SPORTS_TEAMS } from '@/lib/sportsTeams'

const ALIASES: Record<string, string> = {
  'sixers': 'Philadelphia 76ers', 'philadelphia sixers': 'Philadelphia 76ers',
  'blazers': 'Portland Trail Blazers', 'portland blazers': 'Portland Trail Blazers',
  'cavs': 'Cleveland Cavaliers', 'mavs': 'Dallas Mavericks', 'wolves': 'Minnesota Timberwolves', 'twolves': 'Minnesota Timberwolves',
  'los angeles clippers': 'LA Clippers', 'la clippers': 'LA Clippers',
}
let teamIndex: { full: Map<string, string>; nick: Map<string, string | null> } | null = null
function buildIndex() {
  const full = new Map<string, string>()
  const nick = new Map<string, string | null>()
  for (const t of SPORTS_TEAMS) full.set(nameKey(t.name), t.name)
  for (const [alias, target] of Object.entries(ALIASES)) full.set(nameKey(alias), target)
  for (const t of SPORTS_TEAMS) {
    const w = t.name.split(/\s+/)
    for (let i = 1; i < w.length; i++) {     // chaque fin de nom : « Trail Blazers », « Blazers »
      const k = nameKey(w.slice(i).join(' '))
      if (k.length < 5) continue
      nick.set(k, nick.has(k) && nick.get(k) !== t.name ? null : t.name)   // null = ambigu
    }
  }
  return { full, nick }
}
/** Nom officiel de l'équipe désignée par cette écriture, ou null si on ne peut pas être sûr. */
export function resolveTeam(value: string): string | null {
  const v = (value || '').trim()
  if (!v) return null
  teamIndex = teamIndex || buildIndex()
  const swaps = [v, v.replace(/^l\.?a\.?\s+/i, 'Los Angeles '), v.replace(/^los angeles\s+/i, 'LA '), v.replace(/^n\.?y\.?\s+/i, 'New York ')]
  for (const s of swaps) { const hit = teamIndex.full.get(nameKey(s)); if (hit) return hit }
  for (const s of swaps) { const hit = teamIndex.nick.get(nameKey(s)); if (hit) return hit }
  return null
}

export function findTeamGroups(mine: VariantCard[], ignored: Set<string>): VariantGroup[] {
  const byTeam = new Map<string, Map<string, string[]>>()
  for (const c of mine) {
    const v = (c.value || '').trim()
    const team = resolveTeam(v)
    if (!team || v === team) continue
    const key = 'team:' + nameKey(team)
    if (ignored.has(key)) continue
    const m = byTeam.get(team) || new Map<string, string[]>()
    m.set(v, [...(m.get(v) || []), c.id])
    byTeam.set(team, m)
  }
  return [...byTeam.entries()].map(([team, vs]) => ({ key: 'team:' + nameKey(team), canonical: team, variants: [...vs.entries()].map(([value, ids]) => ({ value, ids })) })).sort((a, b) => a.canonical.localeCompare(b.canonical))
}
