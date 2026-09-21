export interface CountryOption { code: string; name: string }

// Pays d'origine les plus representes en NBA (connaissance generale du
// sport) -- affiches en premier dans le selecteur de la fiche joueur.
export const NBA_TOP_COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'États-Unis' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australie' },
  { code: 'RS', name: 'Serbie' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'TR', name: 'Turquie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'HR', name: 'Croatie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'GR', name: 'Grèce' },
  { code: 'NG', name: 'Nigéria' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'DO', name: 'République dominicaine' },
]

// Reste du monde -- couvre les autres nationalites deja vues en NBA/basket
// international, triees alphabetiquement.
export const OTHER_COUNTRIES: CountryOption[] = [
  { code: 'AR', name: 'Argentine' },
  { code: 'AO', name: 'Angola' },
  { code: 'AT', name: 'Autriche' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BA', name: 'Bosnie-Herzégovine' },
  { code: 'BR', name: 'Brésil' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'CV', name: 'Cap-Vert' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CL', name: 'Chili' },
  { code: 'CN', name: 'Chine' },
  { code: 'CO', name: 'Colombie' },
  { code: 'CD', name: 'RD Congo' },
  { code: 'CG', name: 'Congo' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CZ', name: 'République tchèque' },
  { code: 'DK', name: 'Danemark' },
  { code: 'EG', name: 'Égypte' },
  { code: 'EE', name: 'Estonie' },
  { code: 'FI', name: 'Finlande' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GE', name: 'Géorgie' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GN', name: 'Guinée' },
  { code: 'HT', name: 'Haïti' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IS', name: 'Islande' },
  { code: 'IL', name: 'Israël' },
  { code: 'IT', name: 'Italie' },
  { code: 'JM', name: 'Jamaïque' },
  { code: 'JP', name: 'Japon' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LB', name: 'Liban' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'ML', name: 'Mali' },
  { code: 'MX', name: 'Mexique' },
  { code: 'ME', name: 'Monténégro' },
  { code: 'MA', name: 'Maroc' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'NE', name: 'Niger' },
  { code: 'NO', name: 'Norvège' },
  { code: 'PA', name: 'Panama' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Porto Rico' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'RU', name: 'Russie' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'ZA', name: 'Afrique du Sud' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'SS', name: 'Soudan du Sud' },
  { code: 'SD', name: 'Soudan' },
  { code: 'SE', name: 'Suède' },
  { code: 'CH', name: 'Suisse' },
  { code: 'TZ', name: 'Tanzanie' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VI', name: 'Îles Vierges' },
  { code: 'ZM', name: 'Zambie' },
]

export const ALL_NBA_COUNTRIES: CountryOption[] = [...NBA_TOP_COUNTRIES, ...OTHER_COUNTRIES]

export function nbaCountryName(code: string | null | undefined): string | null {
  const c = (code || '').trim().toUpperCase()
  if (!c) return null
  return ALL_NBA_COUNTRIES.find(x => x.code === c)?.name || null
}

// ESPN renvoie la citoyenneté en nom anglais ("Lithuania", "Ivory Coast"...)
// -- table de correspondance vers nos codes ISO pour l'auto-remplissage.
const ESPN_NAME_TO_CODE: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'canada': 'CA', 'france': 'FR', 'australia': 'AU',
  'serbia': 'RS', 'germany': 'DE', 'turkey': 'TR', 'turkiye': 'TR', 'lithuania': 'LT',
  'spain': 'ES', 'croatia': 'HR', 'slovenia': 'SI', 'greece': 'GR', 'nigeria': 'NG',
  'cameroon': 'CM', 'dominican republic': 'DO', 'argentina': 'AR', 'angola': 'AO',
  'austria': 'AT', 'bahamas': 'BS', 'belgium': 'BE', 'bosnia and herzegovina': 'BA',
  'brazil': 'BR', 'bulgaria': 'BG', 'cabo verde': 'CV', 'cape verde': 'CV', 'chad': 'TD',
  'chile': 'CL', 'china': 'CN', 'colombia': 'CO', 'democratic republic of the congo': 'CD',
  'dr congo': 'CD', 'congo': 'CG', 'ivory coast': 'CI', "cote d'ivoire": 'CI',
  'czech republic': 'CZ', 'czechia': 'CZ', 'denmark': 'DK', 'egypt': 'EG', 'estonia': 'EE',
  'finland': 'FI', 'gabon': 'GA', 'georgia': 'GE', 'ghana': 'GH', 'guinea': 'GN',
  'haiti': 'HT', 'hungary': 'HU', 'iceland': 'IS', 'israel': 'IL', 'italy': 'IT',
  'jamaica': 'JM', 'japan': 'JP', 'kenya': 'KE', 'latvia': 'LV', 'lebanon': 'LB',
  'luxembourg': 'LU', 'north macedonia': 'MK', 'macedonia': 'MK', 'mali': 'ML',
  'mexico': 'MX', 'montenegro': 'ME', 'morocco': 'MA', 'mozambique': 'MZ',
  'netherlands': 'NL', 'new zealand': 'NZ', 'niger': 'NE', 'norway': 'NO', 'panama': 'PA',
  'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT', 'puerto rico': 'PR',
  'romania': 'RO', 'russia': 'RU', 'rwanda': 'RW', 'senegal': 'SN', 'slovakia': 'SK',
  'south africa': 'ZA', 'south korea': 'KR', 'south sudan': 'SS', 'sudan': 'SD',
  'sweden': 'SE', 'switzerland': 'CH', 'tanzania': 'TZ', 'tunisia': 'TN', 'ukraine': 'UA',
  'united kingdom': 'GB', 'great britain': 'GB', 'england': 'GB', 'uruguay': 'UY',
  'venezuela': 'VE', 'virgin islands': 'VI', 'us virgin islands': 'VI', 'zambia': 'ZM',
}

export function espnCitizenshipToCode(citizenship: string | null | undefined): string | null {
  if (!citizenship) return null
  return ESPN_NAME_TO_CODE[citizenship.trim().toLowerCase()] || null
}
