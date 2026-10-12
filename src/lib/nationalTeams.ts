// Equipes nationales de football : couleur (maillot / drapeau) et code drapeau, pour la barre d'equipe et le medaillon des vignettes.
// Les noms viennent du texte libre des cartes : anglais et francais, sans accents ni casse.
export interface NationalTeam { name: string; code: string; color: string }

// [nom principal, code drapeau (flagcdn), couleur, ...alias]
const RAW: [string, string, string, ...string[]][] = [
  ['France', 'fr', '#0055a4', 'les bleus', 'equipe de france'],
  ['Spain', 'es', '#c60b1e', 'espagne'],
  ['England', 'gb-eng', '#cf081f', 'angleterre'],
  ['Germany', 'de', '#dd0000', 'allemagne'],
  ['Italy', 'it', '#0066cc', 'italie'],
  ['Portugal', 'pt', '#c8102e'],
  ['Netherlands', 'nl', '#f36c21', 'pays-bas', 'pays bas', 'hollande', 'holland'],
  ['Belgium', 'be', '#e30613', 'belgique'],
  ['Croatia', 'hr', '#d4202a', 'croatie'],
  ['Brazil', 'br', '#f7d117', 'bresil'],
  ['Argentina', 'ar', '#6cace4', 'argentine'],
  ['Uruguay', 'uy', '#5cbfeb'],
  ['Colombia', 'co', '#fcd116', 'colombie'],
  ['Mexico', 'mx', '#006847', 'mexique'],
  ['United States', 'us', '#0a3161', 'usa', 'etats-unis', 'etats unis', 'u.s.a.'],
  ['Canada', 'ca', '#d52b1e'],
  ['Japan', 'jp', '#1c3f94', 'japon'],
  ['South Korea', 'kr', '#cd2e3a', 'coree du sud', 'korea republic', 'coree'],
  ['Morocco', 'ma', '#c1272d', 'maroc'],
  ['Senegal', 'sn', '#00853f'],
  ['Nigeria', 'ng', '#008751'],
  ['Ghana', 'gh', '#fcd116'],
  ['Cameroon', 'cm', '#007a5e', 'cameroun'],
  ['Ivory Coast', 'ci', '#f77f00', 'cote d\'ivoire', 'cote divoire'],
  ['Algeria', 'dz', '#006233', 'algerie'],
  ['Tunisia', 'tn', '#e70013', 'tunisie'],
  ['Egypt', 'eg', '#ce1126', 'egypte'],
  ['Switzerland', 'ch', '#d52b1e', 'suisse'],
  ['Denmark', 'dk', '#c8102e', 'danemark'],
  ['Sweden', 'se', '#006aa7', 'suede'],
  ['Norway', 'no', '#ba0c2f', 'norvege'],
  ['Poland', 'pl', '#dc143c', 'pologne'],
  ['Austria', 'at', '#ed2939', 'autriche'],
  ['Czech Republic', 'cz', '#d7141a', 'tchequie', 'republique tcheque', 'czechia'],
  ['Serbia', 'rs', '#c6363c', 'serbie'],
  ['Scotland', 'gb-sct', '#0b3d91', 'ecosse'],
  ['Wales', 'gb-wls', '#c8102e', 'pays de galles'],
  ['Ireland', 'ie', '#169b62', 'irlande', 'republic of ireland'],
  ['Northern Ireland', 'gb-nir', '#2e8b57', 'irlande du nord'],
  ['Turkey', 'tr', '#e30a17', 'turquie', 'turkiye'],
  ['Ukraine', 'ua', '#0057b7'],
  ['Greece', 'gr', '#0d5eaf', 'grece'],
  ['Australia', 'au', '#00843d', 'australie'],
  ['Iran', 'ir', '#239f40'],
  ['Saudi Arabia', 'sa', '#006c35', 'arabie saoudite'],
  ['Qatar', 'qa', '#8a1538'],
  ['Ecuador', 'ec', '#ffd100', 'equateur'],
  ['Chile', 'cl', '#d52b1e', 'chili'],
  ['Peru', 'pe', '#d91023', 'perou'],
  ['Paraguay', 'py', '#d52b1e'],
  ['Venezuela', 've', '#a21c2a'],
  ['Bolivia', 'bo', '#007a33', 'bolivie'],
  ['Costa Rica', 'cr', '#ce1126'],
  ['Panama', 'pa', '#d21034'],
  ['Jamaica', 'jm', '#009b3a', 'jamaique'],
  ['Haiti', 'ht', '#00209f'],
  ['Honduras', 'hn', '#0073cf'],
  ['DR Congo', 'cd', '#007fff', 'rd congo', 'congo dr', 'congo rd'],
  ['Mali', 'ml', '#14b53a'],
  ['Burkina Faso', 'bf', '#ef2b2d'],
  ['South Africa', 'za', '#007749', 'afrique du sud'],
  ['Cape Verde', 'cv', '#003893', 'cap-vert', 'cap vert'],
  ['Gabon', 'ga', '#009e60'],
  ['Hungary', 'hu', '#ce2939', 'hongrie'],
  ['Romania', 'ro', '#fcd116', 'roumanie'],
  ['Slovakia', 'sk', '#0b4ea2', 'slovaquie'],
  ['Slovenia', 'si', '#005da4', 'slovenie'],
  ['Finland', 'fi', '#003580', 'finlande'],
  ['Iceland', 'is', '#02529c', 'islande'],
  ['Russia', 'ru', '#d52b1e', 'russie'],
  ['New Zealand', 'nz', '#111111', 'nouvelle-zelande', 'nouvelle zelande'],
  ['Uzbekistan', 'uz', '#1eb53a', 'ouzbekistan'],
  ['Jordan', 'jo', '#ce1126', 'jordanie'],
  ['Curacao', 'cw', '#002b7f'],
  ['Bosnia and Herzegovina', 'ba', '#002f6c', 'bosnie', 'bosnie-herzegovine', 'bosnia'],
  ['Albania', 'al', '#e41e20', 'albanie'],
  ['North Macedonia', 'mk', '#d20000', 'macedoine du nord', 'macedoine'],
  ['Georgia', 'ge', '#d52b1e', 'georgie'],
  ['Montenegro', 'me', '#c40308'],
  ['Israel', 'il', '#0038b8'],
  ['China', 'cn', '#de2910', 'chine'],
  ['Iraq', 'iq', '#ce1126', 'irak'],
  ['Angola', 'ao', '#cc092f'],
  ['Zambia', 'zm', '#198a00', 'zambie'],
  ['Guinea', 'gn', '#ce1126', 'guinee'],
  ['Benin', 'bj', '#008751'],
  ['Togo', 'tg', '#006a4e'],
]

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const BY_NAME = new Map<string, NationalTeam>()
for (const [name, code, color, ...aliases] of RAW) {
  const t = { name, code, color }
  for (const n of [name, ...aliases]) BY_NAME.set(norm(n), t)
}

/** Equipe nationale de football a partir du texte libre d'une carte ; null si inconnue */
export function nationalTeam(name?: string | null): NationalTeam | null {
  const n = norm(name || '')
  return n ? BY_NAME.get(n) || null : null
}

/** Drapeau (image publique flagcdn, largeur 80 px) */
export function flagUrl(code: string): string {
  return `https://flagcdn.com/w80/${code}.png`
}

// ---- Ecuries de F1 : le champ equipe des cartes est un texte long et variable ("Oracle Red Bull Racing", "Visa Cash App RB Formula One Team"...),
// donc reconnaissance par mots-cles (ordre important : Racing Bulls avant Red Bull). Pas de logo embarque : voir public/team-logos/f1-<slug>.png,
// sinon l'abreviation de l'ecurie est affichee.
export interface RaceTeam { slug: string; name: string; abbr: string; color: string }
const F1_RAW: [string, string, string, string, string[]][] = [
  ['racing-bulls', 'Racing Bulls', 'RB', '#6692ff', ['racing bulls', 'visa cash app', 'alphatauri', 'alpha tauri', 'toro rosso', 'rb formula']],
  ['red-bull', 'Red Bull Racing', 'RBR', '#1b3a8f', ['red bull']],
  ['ferrari', 'Scuderia Ferrari', 'SF', '#dc0000', ['ferrari']],
  ['mercedes', 'Mercedes', 'MER', '#00d2be', ['mercedes']],
  ['mclaren', 'McLaren', 'MCL', '#ff8000', ['mclaren']],
  ['aston-martin', 'Aston Martin', 'AMR', '#006f62', ['aston martin']],
  ['alpine', 'Alpine', 'ALP', '#0090ff', ['alpine']],
  ['renault', 'Renault', 'REN', '#ffd800', ['renault']],
  ['williams', 'Williams', 'WIL', '#005aff', ['williams']],
  ['haas', 'Haas', 'HAAS', '#b6babd', ['haas']],
  ['audi', 'Audi', 'AUD', '#f50537', ['audi']],
  ['alfa-romeo', 'Alfa Romeo', 'ALF', '#9b0000', ['alfa romeo']],
  ['sauber', 'Sauber', 'SAU', '#52e252', ['sauber']],
  ['cadillac', 'Cadillac', 'CAD', '#9aa0a6', ['cadillac']],
  ['racing-point', 'Racing Point', 'RP', '#f596c8', ['racing point', 'force india']],
  ['lotus', 'Lotus', 'LOT', '#0b6e4f', ['lotus']],
  ['brawn', 'Brawn GP', 'BGP', '#d9ff00', ['brawn']],
  ['jordan', 'Jordan', 'JOR', '#ffd200', ['jordan']],
  ['benetton', 'Benetton', 'BEN', '#00a859', ['benetton']],
]
export function raceTeam(name?: string | null): RaceTeam | null {
  const n = ' ' + norm(name || '') + ' '
  if (n.trim() === '') return null
  for (const [slug, nm, abbr, color, kws] of F1_RAW) {
    if (kws.some(k => n.includes(' ' + k)) || (kws.length === 1 && n.includes(kws[0]))) return { slug, name: nm, abbr, color }
  }
  return null
}
