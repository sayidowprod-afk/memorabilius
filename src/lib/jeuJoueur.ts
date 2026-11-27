// Joueur mystère : types, comparaison et tirage du joueur du jour (partagés ; le tirage et la comparaison ne tournent que côté serveur,
// pour que le joueur du jour ne soit pas lisible dans la page). Données figées dans src/data/jeu-joueur.json (script : scripts/build-jeu-joueur.mjs).

export const MAX_TRIES = 8
export const EPOCH_MS = Date.UTC(2026, 10, 27)   // jour n°1

export type MysteryPlayer = {
  id: string; name: string; team: string; teamName: string; conf: string; div: string
  pos: string; height: number; dob: string; jersey: number; country: string; img: string | null
  legend: boolean          // ancien joueur (équipe = celle de sa carrière, rattachée à la franchise actuelle)
  head: string | null      // tête de sa bobblehead si elle existe (ajoutée à l'envoi)
}
export type St = 'ok' | 'near' | 'no'
export type Cell = { st: St; value: string; short?: string; sub?: string; arrow?: '↑' | '↓'; logo?: string; flag?: string; label: string }
export type Dataset = { players: (Omit<MysteryPlayer, 'head'> & { a?: 1 })[]; order: string[] }

export const FLAGS: Record<string, string> = { USA: 'us', Canada: 'ca', Australia: 'au', Senegal: 'sn', Estonia: 'ee', Spain: 'es', Portugal: 'pt', England: 'gb-eng', Cameroon: 'cm', France: 'fr', Bahamas: 'bs', Croatia: 'hr', Nicaragua: 'ni', 'Bosnia & Herzegovina': 'ba', 'Bosnia and Herzegovina': 'ba', Guinea: 'gn', Serbia: 'rs', Nigeria: 'ng', 'Dominican Republic': 'do', Netherlands: 'nl', Latvia: 'lv', Brazil: 'br', 'New Zealand': 'nz', Switzerland: 'ch', 'Türkiye': 'tr', Turkey: 'tr', Congo: 'cg', Japan: 'jp', Slovenia: 'si', Georgia: 'ge', Greece: 'gr', Italy: 'it', Russia: 'ru', Sweden: 'se', Jamaica: 'jm', Lithuania: 'lt', 'Democratic Republic of Congo': 'cd', 'DR Congo': 'cd', Germany: 'de', 'South Sudan': 'ss', Israel: 'il', Belgium: 'be', 'Czech Republic': 'cz', Finland: 'fi', Ukraine: 'ua', Austria: 'at', Mexico: 'mx', China: 'cn', Argentina: 'ar', Angola: 'ao', Poland: 'pl', Montenegro: 'me', Macedonia: 'mk', 'North Macedonia': 'mk', Venezuela: 've', Haiti: 'ht', Panama: 'pa', 'Puerto Rico': 'pr', 'Virgin Islands': 'vi', 'U.S. Virgin Islands': 'vi', Sudan: 'sd', Egypt: 'eg', Tunisia: 'tn', Gabon: 'ga', 'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', Mali: 'ml', Lebanon: 'lb', Iran: 'ir', Haïti: 'ht', Slovakia: 'sk', Bulgaria: 'bg', Romania: 'ro', Hungary: 'hu', Ireland: 'ie', Scotland: 'gb-sct', Colombia: 've', Uruguay: 'uy', 'Cape Verde': 'cv', 'Trinidad and Tobago': 'tt', Bermuda: 'bm', Philippines: 'ph', Taiwan: 'tw', 'South Korea': 'kr', Kosovo: 'xk', Albania: 'al', 'Republic of the Congo': 'cg', Zaire: 'cd', Yugoslavia: 'rs', 'Soviet Union': 'ru' }
FLAGS.Colombia = 'co'
export const POS_FR: Record<string, string> = { G: 'Arrière', F: 'Ailier', C: 'Pivot' }
const DIV_SHORT: Record<string, string> = { Atlantique: 'ATL', Centrale: 'CEN', 'Sud-Est': 'SE', 'Nord-Ouest': 'NO', Pacifique: 'PAC', 'Sud-Ouest': 'SO' }
export const logoOf = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`

export const cmOf = (inch: number) => `${Math.round(inch * 2.54)} cm`
const feet = (inch: number) => `${Math.floor(inch / 12)}'${inch % 12}"`
export function ageOf(dob: string, now = new Date()) {
  const d = new Date(dob); let a = now.getUTCFullYear() - d.getUTCFullYear()
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--
  return a
}

function num(g: number, a: number, near: number, value: string, short: string, sub?: string): Cell {
  if (g === a) return { st: 'ok', value, short, sub, label: value }
  return { st: Math.abs(g - a) <= near ? 'near' : 'no', value, short, sub, label: value, arrow: a > g ? '↑' : '↓' }
}

// compare un joueur proposé au joueur mystère : 8 cases (équipe, conférence, division, poste, taille, âge, numéro, pays)
export function compare(g: MysteryPlayer | Dataset['players'][number], a: MysteryPlayer | Dataset['players'][number], now = new Date()): Cell[] {
  const same = (x: string, y: string): St => (x === y ? 'ok' : 'no')
  const ga = ageOf(g.dob, now), aa = ageOf(a.dob, now)
  const flag = g.country ? FLAGS[g.country] : undefined
  return [
    { st: same(g.team, a.team), value: g.team, logo: logoOf(g.team), label: g.teamName },
    { st: same(g.conf, a.conf), value: g.conf, short: g.conf === 'Est' ? 'E' : 'O', label: 'conférence ' + g.conf },
    { st: same(g.div, a.div), value: g.div, short: DIV_SHORT[g.div] || g.div, label: 'division ' + g.div },
    { st: same(g.pos, a.pos), value: g.pos, sub: POS_FR[g.pos], label: POS_FR[g.pos] || g.pos },
    num(g.height, a.height, 2, cmOf(g.height), String(Math.round(g.height * 2.54)), feet(g.height)),
    num(ga, aa, 2, String(ga), String(ga), 'ans'),
    num(g.jersey, a.jersey, 3, '#' + g.jersey, String(g.jersey)),
    { st: g.country && a.country ? same(g.country, a.country) : 'no', value: g.country && !flag ? g.country.slice(0, 3).toUpperCase() : g.country ? '' : '—', flag, sub: g.country || undefined, label: g.country || 'inconnu' },
  ]
}

// ── tirage (déterministe : le même joueur pour tout le monde)
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export const parisDay = (d = new Date()) => d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })   // AAAA-MM-JJ
export const dayNumber = (seed: string) => Math.floor((Date.parse(seed + 'T00:00:00Z') - EPOCH_MS) / 86400000) + 1
// temps restant avant le prochain minuit, heure de Paris (en ms)
export function msToParisMidnight(now = new Date()) {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const g = (t: string) => parseInt(p.find(x => x.type === t)?.value || '0')
  return ((23 - g('hour')) * 3600 + (59 - g('minute')) * 60 + (60 - g('second'))) * 1000
}
