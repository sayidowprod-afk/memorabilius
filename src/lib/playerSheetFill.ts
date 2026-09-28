import { fetchEspnPlayerAutofill, type EspnPlayerAutofill } from '@/lib/espnHeadshot'

// Remplissage automatique d'une fiche joueur : stats de la derniere saison,
// age, poste, pays, experience, historique des equipes + une courte description
// dans les notes. La description est GENEREE A PARTIR DES CHIFFRES (aucune
// anecdote inventee) : poste, age, experience, stats, seuils simples et parcours.

const num = (v: string | null | undefined) => {
  const n = v == null ? NaN : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const fr = (v: string | null | undefined) => (v == null ? '' : String(v).replace('.', ','))

export function buildDescription(d: EspnPlayerAutofill): string {
  const parts: string[] = []
  const poste = d.position
  const age = d.age
  const exp = d.experience
  const pts = num(d.points), reb = num(d.rebounds), ast = num(d.assists), min = num(d.minutes)

  const who = [poste, age != null ? `de ${age} ans` : null].filter(Boolean).join(' ')
  if (who) parts.push(`${who}${exp ? `, ${exp}` : ''}.`)
  else if (exp) parts.push(`${exp[0].toUpperCase()}${exp.slice(1)}.`)

  if (pts != null) {
    const stat = [`${fr(d.points)} pts`, d.rebounds != null ? `${fr(d.rebounds)} rbs` : null, d.assists != null ? `${fr(d.assists)} pds` : null]
      .filter(Boolean).join(', ')
    const tail = [d.minutes != null ? `en ${fr(d.minutes)} min` : null, d.gamesPlayed != null ? `sur ${d.gamesPlayed} matchs` : null].filter(Boolean).join(' ')
    parts.push(`${d.season ? `${d.season} : ` : ''}${stat}${tail ? ` ${tail}` : ''}.`)

    // Etiquettes deduites strictement des chiffres.
    const tags: string[] = []
    if (pts >= 20) tags.push('scoreur de premier plan')
    else if (pts >= 14) tags.push('option offensive régulière')
    if (reb != null && reb >= 9) tags.push('gros rebondeur')
    if (ast != null && ast >= 6) tags.push('vrai facilitateur')
    if (min != null && min < 15 && tags.length === 0) tags.push('rôle de rotation')
    if (tags.length) parts.push(`Profil : ${tags.join(', ')}.`)
  } else {
    parts.push('Pas encore de statistiques NBA sur la dernière saison.')
  }

  const hist = d.teamHistory || []
  if (hist.length > 1) {
    const before = hist.slice(0, -1).map(s => s.name).filter((n, i, a) => a.indexOf(n) === i)
    if (before.length) parts.push(`Passé par : ${before.join(', ')}.`)
  }
  return parts.join(' ')
}

export interface SheetFill {
  fields: Record<string, string>
  team_history: EspnPlayerAutofill['teamHistory']
  notes: string
}

// null si ESPN ne connait pas le joueur.
export async function computeSheetFill(name: string): Promise<SheetFill | null> {
  const d = await fetchEspnPlayerAutofill(name, 'nba')
  if (!d) return null
  const fields: Record<string, string> = {}
  if (d.age != null) fields.stat_age = `${d.age} ans`
  if (d.position) fields.stat_poste = d.position
  if (d.countryCode) fields.stat_country = d.countryCode
  if (d.experience) fields.stat_saison = d.experience
  if (d.gamesPlayed != null) fields.stat_matches = d.gamesPlayed
  if (d.minutes != null) fields.stat_minutes = d.minutes
  if (d.points != null) fields.stat_points = d.points
  if (d.rebounds != null) fields.stat_rebonds = d.rebounds
  if (d.assists != null) fields.stat_passes = d.assists
  return { fields, team_history: d.teamHistory, notes: buildDescription(d) }
}
