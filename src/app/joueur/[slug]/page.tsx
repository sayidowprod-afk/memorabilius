import type { Metadata } from 'next'
import { fetchPlayerManuelles, fetchAllPaged } from '@/lib/playerManuelles'
import Link from 'next/link'
import { Suspense, cache } from 'react'
import { fetchCsvCardsForProfilesCached } from '@/lib/csvCardsCache'
import { getCachedHeadshot, fetchEspnPlayerBio } from '@/lib/espnHeadshot'
import BobbleHero from '@/components/BobbleHero'
import TeamBadge from '@/components/TeamBadge'
import { getTeamById } from '@/lib/sportsTeams'
import { bobbleFor, teamBody, type BobbleFig } from '@/lib/bobbleheadsServer'
import { normalizeName, cardPageUrl, stripDiacritics } from '@/lib/playerSlug'
import CommunityCardsSection from './CommunityCardsSection'
import PlayerSetsSection from './PlayerSetsSection'
import PlayerChecklistSection from './PlayerChecklistSection'
import LazySection from '@/components/LazySection'
import ScrollTopButton from '@/components/ScrollTopButton'
import { createServerClient } from '@/lib/supabaseServer'

// La fiche ESPN (findAthleteId -> bio/stats/awards -> noms d'equipes -> numeros
// de maillot par equipe) enchaine plusieurs allers-retours reseau et peut
// prendre plusieurs secondes -- avant, elle bloquait TOUTE la page (rien ne
// s'affichait tant qu'elle n'etait pas finie, "super lent"). Deux composants
// Suspense (BioMeta/BioCareer plus bas) la streament une fois le reste de la
// page deja affiche. cache() dedup le fetch : les deux composants demandent
// la meme bio pour le meme joueur, un seul appel reseau reel.
const getCachedBio = cache((name: string, sport: string) => fetchEspnPlayerBio(name, sport))

export const revalidate = 604800 // 7 jours (etait 24h, 1h avant -- contenu quasi statique, cf. reduction couts Vercel ISR)
// Aucune page pré-générée au build, mais cette déclaration est ce qui active le cache à la demande (ISR) : sans elle, une page à paramètre est
// rendue à CHAQUE visite (en-tête « private, no-store ») et le revalidate ci-dessus est ignoré.
export async function generateStaticParams() { return [] }

// ── Couleurs par équipe (NBA + NFL + NHL + MLB) ───────────────────────────────
const NBA_COLORS: Record<string, { primary: string; secondary: string; abbr: string }> = {
  'Atlanta Hawks': { primary: '#E03A3E', secondary: '#C1D32F', abbr: 'ATL' },
  'Boston Celtics': { primary: '#007A33', secondary: '#FFFFFF', abbr: 'BOS' },
  'Brooklyn Nets': { primary: '#000000', secondary: '#FFFFFF', abbr: 'BKN' },
  'Charlotte Hornets': { primary: '#1D1160', secondary: '#00788C', abbr: 'CHA' },
  'Chicago Bulls': { primary: '#CE1141', secondary: '#FFFFFF', abbr: 'CHI' },
  'Cleveland Cavaliers': { primary: '#860038', secondary: '#FDBB30', abbr: 'CLE' },
  'Dallas Mavericks': { primary: '#00538C', secondary: '#FFFFFF', abbr: 'DAL' },
  'Denver Nuggets': { primary: '#0E2240', secondary: '#FEC524', abbr: 'DEN' },
  'Detroit Pistons': { primary: '#C8102E', secondary: '#1D428A', abbr: 'DET' },
  'Golden State Warriors': { primary: '#1D428A', secondary: '#FFC72C', abbr: 'GSW' },
  'Houston Rockets': { primary: '#CE1141', secondary: '#FFFFFF', abbr: 'HOU' },
  'Indiana Pacers': { primary: '#002D62', secondary: '#FDBB30', abbr: 'IND' },
  'Los Angeles Clippers': { primary: '#C8102E', secondary: '#1D428A', abbr: 'LAC' },
  'Los Angeles Lakers': { primary: '#552583', secondary: '#FDB927', abbr: 'LAL' },
  'Memphis Grizzlies': { primary: '#5D76A9', secondary: '#12173F', abbr: 'MEM' },
  'Miami Heat': { primary: '#98002E', secondary: '#F9A01B', abbr: 'MIA' },
  'Milwaukee Bucks': { primary: '#00471B', secondary: '#EEE1C6', abbr: 'MIL' },
  'Minnesota Timberwolves': { primary: '#0C2340', secondary: '#236192', abbr: 'MIN' },
  'New Orleans Pelicans': { primary: '#0C2340', secondary: '#85714D', abbr: 'NOP' },
  'New York Knicks': { primary: '#006BB6', secondary: '#F58426', abbr: 'NYK' },
  'Oklahoma City Thunder': { primary: '#007AC1', secondary: '#EF3B24', abbr: 'OKC' },
  'Orlando Magic': { primary: '#0077C0', secondary: '#C4CED4', abbr: 'ORL' },
  'Philadelphia 76ers': { primary: '#006BB6', secondary: '#ED174C', abbr: 'PHI' },
  'Phoenix Suns': { primary: '#1D1160', secondary: '#E56020', abbr: 'PHX' },
  'Portland Trail Blazers': { primary: '#E03A3E', secondary: '#000000', abbr: 'POR' },
  'Sacramento Kings': { primary: '#5A2D81', secondary: '#63727A', abbr: 'SAC' },
  'San Antonio Spurs': { primary: '#C4CED4', secondary: '#000000', abbr: 'SAS' },
  'Toronto Raptors': { primary: '#CE1141', secondary: '#000000', abbr: 'TOR' },
  'Utah Jazz': { primary: '#002B5C', secondary: '#00471B', abbr: 'UTA' },
  'Washington Wizards': { primary: '#002B5C', secondary: '#E31837', abbr: 'WAS' },
  // NBA historiques
  'New Jersey Nets': { primary: '#000000', secondary: '#FFFFFF', abbr: 'NJN' },
  'Seattle SuperSonics': { primary: '#00653A', secondary: '#FFC200', abbr: 'SEA' },
  'Vancouver Grizzlies': { primary: '#29727C', secondary: '#E43C40', abbr: 'VAN' },
  'New Orleans Hornets': { primary: '#002B5C', secondary: '#00788C', abbr: 'NOH' },
  'Charlotte Bobcats': { primary: '#F26522', secondary: '#2D5DAA', abbr: 'BOB' },
  'New Orleans/Oklahoma City Hornets': { primary: '#002B5C', secondary: '#00788C', abbr: 'NOK' },
  // ── NFL ──────────────────────────────────────────────────────────────────────
  'Arizona Cardinals': { primary: '#97233F', secondary: '#FFB612', abbr: 'ARI' },
  'Atlanta Falcons': { primary: '#A71930', secondary: '#000000', abbr: 'ATL' },
  'Baltimore Ravens': { primary: '#241773', secondary: '#9E7C0C', abbr: 'BAL' },
  'Buffalo Bills': { primary: '#00338D', secondary: '#C60C30', abbr: 'BUF' },
  'Carolina Panthers': { primary: '#0085CA', secondary: '#101820', abbr: 'CAR' },
  'Chicago Bears': { primary: '#0B162A', secondary: '#C83803', abbr: 'CHI' },
  'Cincinnati Bengals': { primary: '#FB4F14', secondary: '#000000', abbr: 'CIN' },
  'Cleveland Browns': { primary: '#311D00', secondary: '#FF3C00', abbr: 'CLE' },
  'Dallas Cowboys': { primary: '#003594', secondary: '#869397', abbr: 'DAL' },
  'Denver Broncos': { primary: '#FB4F14', secondary: '#002244', abbr: 'DEN' },
  'Detroit Lions': { primary: '#0076B6', secondary: '#B0B7BC', abbr: 'DET' },
  'Green Bay Packers': { primary: '#203731', secondary: '#FFB612', abbr: 'GB' },
  'Houston Texans': { primary: '#03202F', secondary: '#A71930', abbr: 'HOU' },
  'Indianapolis Colts': { primary: '#002C5F', secondary: '#A2AAAD', abbr: 'IND' },
  'Jacksonville Jaguars': { primary: '#101820', secondary: '#D7A22A', abbr: 'JAX' },
  'Kansas City Chiefs': { primary: '#E31837', secondary: '#FFB81C', abbr: 'KC' },
  'Las Vegas Raiders': { primary: '#000000', secondary: '#A5ACAF', abbr: 'LV' },
  'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E', abbr: 'LAC' },
  'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300', abbr: 'LAR' },
  'Miami Dolphins': { primary: '#008E97', secondary: '#FC4C02', abbr: 'MIA' },
  'Minnesota Vikings': { primary: '#4F2683', secondary: '#FFC62F', abbr: 'MIN' },
  'New England Patriots': { primary: '#002244', secondary: '#C60C30', abbr: 'NE' },
  'New Orleans Saints': { primary: '#101820', secondary: '#D3BC8D', abbr: 'NO' },
  'New York Giants': { primary: '#0B2265', secondary: '#A71930', abbr: 'NYG' },
  'New York Jets': { primary: '#125740', secondary: '#FFFFFF', abbr: 'NYJ' },
  'Philadelphia Eagles': { primary: '#004C54', secondary: '#A5ACAF', abbr: 'PHI' },
  'Pittsburgh Steelers': { primary: '#101820', secondary: '#FFB612', abbr: 'PIT' },
  'San Francisco 49ers': { primary: '#AA0000', secondary: '#B3995D', abbr: 'SF' },
  'Seattle Seahawks': { primary: '#002244', secondary: '#69BE28', abbr: 'SEA' },
  'Tampa Bay Buccaneers': { primary: '#D50A0A', secondary: '#FF7900', abbr: 'TB' },
  'Tennessee Titans': { primary: '#0C2340', secondary: '#4B92DB', abbr: 'TEN' },
  'Washington Commanders': { primary: '#5A1414', secondary: '#FFB612', abbr: 'WAS' },
  'Oakland Raiders': { primary: '#000000', secondary: '#A5ACAF', abbr: 'OAK' },
  'San Diego Chargers': { primary: '#0073CF', secondary: '#FFC20E', abbr: 'SD' },
  'St. Louis Rams': { primary: '#003594', secondary: '#FFA300', abbr: 'STL' },
  'Washington Redskins': { primary: '#773141', secondary: '#FFB612', abbr: 'WAS' },
  'Washington Football Team': { primary: '#5A1414', secondary: '#FFB612', abbr: 'WFT' },
  // ── NHL ──────────────────────────────────────────────────────────────────────
  'Anaheim Ducks': { primary: '#F47A38', secondary: '#B9975B', abbr: 'ANA' },
  'Boston Bruins': { primary: '#FFB81C', secondary: '#000000', abbr: 'BOS' },
  'Buffalo Sabres': { primary: '#002654', secondary: '#FCB514', abbr: 'BUF' },
  'Calgary Flames': { primary: '#C8102E', secondary: '#F1BE48', abbr: 'CGY' },
  'Carolina Hurricanes': { primary: '#CC0000', secondary: '#000000', abbr: 'CAR' },
  'Chicago Blackhawks': { primary: '#CF0A2C', secondary: '#FF6720', abbr: 'CHI' },
  'Colorado Avalanche': { primary: '#6F263D', secondary: '#236192', abbr: 'COL' },
  'Columbus Blue Jackets': { primary: '#002654', secondary: '#CE1126', abbr: 'CBJ' },
  'Dallas Stars': { primary: '#006847', secondary: '#8F8F8C', abbr: 'DAL' },
  'Detroit Red Wings': { primary: '#CE1126', secondary: '#FFFFFF', abbr: 'DET' },
  'Edmonton Oilers': { primary: '#FF4C00', secondary: '#041E42', abbr: 'EDM' },
  'Florida Panthers': { primary: '#041E42', secondary: '#C8102E', abbr: 'FLA' },
  'Los Angeles Kings': { primary: '#111111', secondary: '#A2AAAD', abbr: 'LAK' },
  'Minnesota Wild': { primary: '#154734', secondary: '#A6192E', abbr: 'MIN' },
  'Montréal Canadiens': { primary: '#AF1E2D', secondary: '#192168', abbr: 'MTL' },
  'Nashville Predators': { primary: '#041E42', secondary: '#FFB81C', abbr: 'NSH' },
  'New Jersey Devils': { primary: '#CE1126', secondary: '#000000', abbr: 'NJD' },
  'New York Islanders': { primary: '#00539B', secondary: '#F47D30', abbr: 'NYI' },
  'New York Rangers': { primary: '#0038A8', secondary: '#CE1126', abbr: 'NYR' },
  'Ottawa Senators': { primary: '#E31837', secondary: '#C69214', abbr: 'OTT' },
  'Philadelphia Flyers': { primary: '#F74902', secondary: '#000000', abbr: 'PHI' },
  'Pittsburgh Penguins': { primary: '#000000', secondary: '#FCB514', abbr: 'PIT' },
  'San Jose Sharks': { primary: '#006D75', secondary: '#EA7200', abbr: 'SJS' },
  'Seattle Kraken': { primary: '#001628', secondary: '#99D9D9', abbr: 'SEA' },
  'St. Louis Blues': { primary: '#002F87', secondary: '#FCB514', abbr: 'STL' },
  'Tampa Bay Lightning': { primary: '#002868', secondary: '#FFFFFF', abbr: 'TBL' },
  'Toronto Maple Leafs': { primary: '#00205B', secondary: '#FFFFFF', abbr: 'TOR' },
  'Utah Hockey Club': { primary: '#6CACE4', secondary: '#010101', abbr: 'UTA' },
  'Vancouver Canucks': { primary: '#00205B', secondary: '#00843D', abbr: 'VAN' },
  'Vegas Golden Knights': { primary: '#B4975A', secondary: '#333F42', abbr: 'VGK' },
  'Washington Capitals': { primary: '#041E42', secondary: '#C8102E', abbr: 'WSH' },
  'Winnipeg Jets': { primary: '#041E42', secondary: '#004C97', abbr: 'WPG' },
  'Phoenix Coyotes': { primary: '#8C2633', secondary: '#E2D6B5', abbr: 'PHX' },
  'Arizona Coyotes': { primary: '#8C2633', secondary: '#E2D6B5', abbr: 'ARI' },
  // ── MLB ──────────────────────────────────────────────────────────────────────
  'Arizona Diamondbacks': { primary: '#A71930', secondary: '#E3D4AD', abbr: 'ARI' },
  'Atlanta Braves': { primary: '#CE1141', secondary: '#13274F', abbr: 'ATL' },
  'Baltimore Orioles': { primary: '#DF4601', secondary: '#000000', abbr: 'BAL' },
  'Boston Red Sox': { primary: '#BD3039', secondary: '#0C2340', abbr: 'BOS' },
  'Chicago Cubs': { primary: '#0E3386', secondary: '#CC3433', abbr: 'CHC' },
  'Chicago White Sox': { primary: '#27251F', secondary: '#C4CED4', abbr: 'CWS' },
  'Cincinnati Reds': { primary: '#C6011F', secondary: '#000000', abbr: 'CIN' },
  'Cleveland Guardians': { primary: '#00385D', secondary: '#E31937', abbr: 'CLE' },
  'Colorado Rockies': { primary: '#33006F', secondary: '#C4CED4', abbr: 'COL' },
  'Detroit Tigers': { primary: '#0C2340', secondary: '#FA4616', abbr: 'DET' },
  'Houston Astros': { primary: '#002D62', secondary: '#EB6E1F', abbr: 'HOU' },
  'Kansas City Royals': { primary: '#004687', secondary: '#C09A5B', abbr: 'KC' },
  'Los Angeles Angels': { primary: '#BA0021', secondary: '#003263', abbr: 'LAA' },
  'Los Angeles Dodgers': { primary: '#005A9C', secondary: '#EF3E42', abbr: 'LAD' },
  'Miami Marlins': { primary: '#00A3E0', secondary: '#EF3340', abbr: 'MIA' },
  'Milwaukee Brewers': { primary: '#FFC52F', secondary: '#12284B', abbr: 'MIL' },
  'Minnesota Twins': { primary: '#002B5C', secondary: '#D31145', abbr: 'MIN' },
  'New York Mets': { primary: '#002D72', secondary: '#FF5910', abbr: 'NYM' },
  'New York Yankees': { primary: '#132448', secondary: '#C4CED4', abbr: 'NYY' },
  'Oakland Athletics': { primary: '#003831', secondary: '#EFB21E', abbr: 'OAK' },
  'Philadelphia Phillies': { primary: '#E81828', secondary: '#002D72', abbr: 'PHI' },
  'Pittsburgh Pirates': { primary: '#27251F', secondary: '#FDB827', abbr: 'PIT' },
  'San Diego Padres': { primary: '#2F241D', secondary: '#FFC425', abbr: 'SD' },
  'San Francisco Giants': { primary: '#FD5A1E', secondary: '#27251F', abbr: 'SF' },
  'Seattle Mariners': { primary: '#0C2C56', secondary: '#005C5C', abbr: 'SEA' },
  'St. Louis Cardinals': { primary: '#C41E3A', secondary: '#0C2340', abbr: 'STL' },
  'Tampa Bay Rays': { primary: '#092C5C', secondary: '#8FBCE6', abbr: 'TB' },
  'Texas Rangers': { primary: '#003278', secondary: '#C0111F', abbr: 'TEX' },
  'Toronto Blue Jays': { primary: '#134A8E', secondary: '#1D2D5C', abbr: 'TOR' },
  'Washington Nationals': { primary: '#AB0003', secondary: '#14225A', abbr: 'WSH' },
  'Cleveland Indians': { primary: '#00385D', secondary: '#E31937', abbr: 'CLE' },
  'Anaheim Angels': { primary: '#BA0021', secondary: '#003263', abbr: 'ANA' },
  'Montreal Expos': { primary: '#003087', secondary: '#E4002B', abbr: 'MON' },
}

function getTeamColors(teamName: string) {
  return NBA_COLORS[teamName] ?? {
    primary: '#444444',
    secondary: '#FFFFFF',
    abbr: teamName.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 3).toUpperCase(),
  }
}

function getHonorStyle(honor: string): { background: string; color: string } {
  // Honours dorés (championnats, MVP, records) vs gris (All-Star, All-NBA, etc.)
  if (/champ|mvp|hall of fame|roy|scoring title|75th|anniversary|finalist/i.test(honor) &&
    !/all.?star|all.?nba|all.?defensive|all.?rookie/i.test(honor)) {
    return { background: '#6B4500', color: '#FFC72C' }
  }
  return { background: '#4a4a4a', color: '#e0e0e0' }
}

function JerseyIcon({ primary, secondary, abbr, number, sport = 'nba' }: {
  primary: string; secondary: string; abbr: string; number?: string; sport?: string
}) {
  const displayText = number ?? abbr
  const sz = number ? (number.length <= 2 ? '15' : '11') : (abbr.length > 2 ? '8' : '10')
  const font = "Impact,'Arial Narrow',Arial,sans-serif"

  // NFL – football américain : larges épaules (épaulières), col rond, bande de manche
  if (sport === 'nfl') return (
    <svg width="40" height="50" viewBox="0 0 40 50" style={{ display: 'block' }}>
      {/* Corps + manches : large au niveau des épaules, se resserre sur le corps */}
      <path d="M 9 50 L 9 26 Q 3 22 1 13 L 1 7 Q 2 2 10 2 L 15 2 Q 20 5 25 2 L 30 2 Q 38 2 39 7 L 39 13 Q 37 22 31 26 L 31 50 Z"
        fill={primary} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      {/* Bande de couleur sur les manches */}
      <line x1="1" y1="10" x2="1" y2="15" stroke={secondary} strokeWidth="6" strokeLinecap="butt"/>
      <line x1="39" y1="10" x2="39" y2="15" stroke={secondary} strokeWidth="6" strokeLinecap="butt"/>
      {/* Col rond */}
      <path d="M 15 2 Q 20 7 25 2" fill="none" stroke={secondary} strokeWidth="2.5" strokeLinecap="round"/>
      <text x="20" y="40" textAnchor="middle" dominantBaseline="middle"
        fill={secondary} fontSize={sz} fontWeight="bold" fontFamily={font}>{displayText}</text>
    </svg>
  )

  // NHL – hockey sur glace : manches longues, bande horizontale, col bicolore
  if (sport === 'hockey') return (
    <svg width="40" height="50" viewBox="0 0 40 50" style={{ display: 'block' }}>
      {/* Corps + longues manches */}
      <path d="M 9 50 L 9 30 Q 3 25 1 17 L 1 7 Q 2 2 10 2 L 16 2 Q 20 6 24 2 L 30 2 Q 38 2 39 7 L 39 17 Q 37 25 31 30 L 31 50 Z"
        fill={primary} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      {/* Bande horizontale caractéristique hockey sur le bas du corps */}
      <rect x="9" y="37" width="22" height="5" fill={secondary} opacity="0.85"/>
      {/* Col coloré */}
      <path d="M 16 2 Q 20 8 24 2 Q 20 4 16 2 Z" fill={secondary}/>
      {/* Bandes sur les manches */}
      <line x1="1" y1="12" x2="1" y2="17" stroke={secondary} strokeWidth="5" strokeLinecap="butt"/>
      <line x1="39" y1="12" x2="39" y2="17" stroke={secondary} strokeWidth="5" strokeLinecap="butt"/>
      <text x="20" y="46" textAnchor="middle" dominantBaseline="middle"
        fill={secondary} fontSize={sz} fontWeight="bold" fontFamily={font}>{displayText}</text>
    </svg>
  )

  // MLB – baseball : col V + boutonnage, manches courtes
  if (sport === 'baseball') return (
    <svg width="40" height="50" viewBox="0 0 40 50" style={{ display: 'block' }}>
      {/* Corps + manches courtes */}
      <path d="M 9 50 L 9 27 Q 5 23 3 14 L 3 6 Q 4 2 12 2 L 16 2 L 16 8 Q 20 11 24 8 L 24 2 L 28 2 Q 36 2 37 6 L 37 14 Q 35 23 31 27 L 31 50 Z"
        fill={primary} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      {/* Col + placket couleur secondaire */}
      <path d="M 16 2 L 16 8 Q 20 11 24 8 L 24 2 Q 20 5 16 2 Z" fill={secondary} opacity="0.9"/>
      {/* Boutons */}
      {[16, 22, 28, 34, 41].map(y => (
        <circle key={y} cx="20" cy={y} r="1.1" fill={secondary} opacity="0.7"/>
      ))}
      <text x="20" y="41" textAnchor="middle" dominantBaseline="middle"
        fill={secondary} fontSize={sz} fontWeight="bold" fontFamily={font}>{displayText}</text>
    </svg>
  )

  // Football (soccer) – maillot slim : col en V, manches courtes, bandes d'épaule
  if (sport === 'football') return (
    <svg width="40" height="50" viewBox="0 0 40 50" style={{ display: 'block' }}>
      {/* Corps + manches courtes, plus slim que les autres sports */}
      <path d="M 10 50 L 10 27 Q 6 23 5 14 L 5 7 Q 5 2 12 2 L 17 2 Q 20 0 23 2 L 28 2 Q 35 2 35 7 L 35 14 Q 34 23 30 27 L 30 50 Z"
        fill={primary} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      {/* Col en V */}
      <path d="M 17 2 L 20 10 L 23 2 Z" fill={secondary} opacity="0.9"/>
      {/* Bandes d'épaule */}
      <line x1="5" y1="9" x2="5" y2="14" stroke={secondary} strokeWidth="4" strokeLinecap="butt"/>
      <line x1="35" y1="9" x2="35" y2="14" stroke={secondary} strokeWidth="4" strokeLinecap="butt"/>
      <text x="20" y="40" textAnchor="middle" dominantBaseline="middle"
        fill={secondary} fontSize={sz} fontWeight="bold" fontFamily={font}>{displayText}</text>
    </svg>
  )

  // NBA (défaut) – débardeur sans manches : deux bretelles + emmanchure visible (evenodd)
  return (
    <svg width="40" height="50" viewBox="0 0 40 50" style={{ display: 'block' }}>
      {/* La zone centrale (x=14-26, y=2-22) est transparente → emmanchures visibles */}
      <path fillRule="evenodd"
        d="M 9 2 L 31 2 L 31 48 L 9 48 Z M 14 2 L 26 2 L 26 22 L 14 22 Z"
        fill={primary} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      {/* Col en V tracé sur le bord de l'emmanchure */}
      <path d="M 14 2 L 20 9 L 26 2" fill="none" stroke={secondary} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"/>
      <text x="20" y="37" textAnchor="middle" dominantBaseline="middle"
        fill={secondary} fontSize={sz} fontWeight="bold" fontFamily={font}>{displayText}</text>
    </svg>
  )
}

// Request coalescing: si plusieurs renders simultanés demandent le même slug
// (dev mode HMR), on fait un seul appel Supabase au lieu de N → évite les timeouts
const _inflight = new Map<string, Promise<any>>()
function fetchPlayerOnce(slug: string, fn: () => Promise<any>) {
  if (_inflight.has(slug)) return _inflight.get(slug)!
  const p = fn()
  _inflight.set(slug, p)
  p.finally(() => _inflight.delete(slug))
  return p
}

const supabase = createServerClient()

function slugToName(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function seasonLabel(startYear: number, endYear: number, sport = 'nba') {
  if (['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)) {
    return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`
  }
  return startYear === endYear
    ? `${startYear}–${String(startYear + 1).slice(2)}`
    : `${startYear}–${String(endYear + 1).slice(2)}`
}

function buildCareerTimeline(career: { year: number; teamName: string }[]) {
  const sorted = [...career].filter(e => e.year > 0).sort((a, b) => a.year - b.year)
  const runs: { teamName: string; startYear: number; endYear: number }[] = []
  for (const { year, teamName } of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.teamName === teamName && year <= last.endYear + 1) {
      last.endYear = year
    } else {
      runs.push({ teamName, startYear: year, endYear: year })
    }
  }
  return runs
}

const SPORT_LABELS: Record<string, string> = {
  nba: '🏀 NBA', nfl: '🏈 NFL', baseball: '⚾ Baseball',
  hockey: '🏒 Hockey', pokemon: '🎴 Pokémon', mtg: '🧙 MTG',
}

function fetchPlayer(slug: string) {
  return fetchPlayerOnce(slug, () => _fetchPlayer(slug))
}

async function _fetchPlayer(slug: string) {
  const playerName = slugToName(slug)
  const normTarget = normalizeName(playerName)
  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  // RPC get_player_sets_unaccent + manuelles + profiles en parallèle
  // La RPC fait le JOIN + GROUP BY côté Postgres — aucune pagination OFFSET nécessaire
  // Nécessite l'index trigram/fonctionnel sur card_set_entries.player_name pour être rapide
  // get_player_sets_unaccent (voir scripts/sql-player-entries-unaccent.sql) fusionne les
  // variantes orthographiques d'un même joueur ("Doncic"/"Dončić") -- avant, chaque graphie
  // avait sa propre liste de sets, incomplète. Repli sur l'ancienne get_player_sets
  // (sensible aux accents) si la migration SQL n'a pas encore été exécutée.
  // .limit(5000) ne suffisait pas a lui seul : PostgREST plafonne chaque
  // reponse a 1000 lignes (max_rows) quel que soit le .limit() demande, deja
  // rencontre ailleurs sur le site (voir bcc3a8f0) -- un joueur avec plus de
  // 1000 cartes communaute en perdait silencieusement le reste. Pagination
  // reelle via .range(), sans plafond ("jamais de limites").
  const fetchAllManuellesForPlayer = async () => {
    const all = await fetchPlayerManuelles(supabase, 'id, nom, annee, rc, auto, num, patch, marque, collection, variation, image_recto, is_horizontal, disponible_vente, created_at, user_id, profiles(display_name, avatar_url, couleur_bordure, is_demo)', firstName, lastName)
    return all.filter((m: any) => !m.profiles?.is_demo) // compte démo (salons) : invisible
  }

  // .limit(200) laissait de cote les profils CSV au-dela des 200 premiers
  // (498 profils ont un lien_csv) -- cartes manquantes pour ~60% des
  // collectionneurs. Meme pagination .range() que fetchAllManuellesForPlayer.
  const fetchAllCsvProfiles = async () => fetchAllPaged(from => supabase
    .from('profiles')
    .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
    .not('lien_csv', 'is', null)
    .eq('is_demo', false)
    .order('id')
    .range(from, from + 999))

  // get_player_sets (indexee, cf idx_card_set_entries_player_name_trgm) essayee
  // en premier -- get_player_sets_unaccent n'a pas encore l'index equivalent sur
  // la colonne sans accents (echec de build recurrent, incident Supabase Management
  // API en cours depuis le 2026-10-23) et peut timeout sur un prenom courant.
  // Repli temporaire sur get_player_sets_unaccent (sensible aux accents en moins bon,
  // mais fusionne mieux les variantes orthographiques) le temps que l'index puisse
  // enfin etre construit.
  const [setsRpcRes0, manuData, profilesData] = await Promise.all([
    supabase.rpc('get_player_sets', { p_first: firstName, p_last: lastName }),
    fetchAllManuellesForPlayer(),
    fetchAllCsvProfiles(),
  ])

  const matchedManu = manuData.filter((m: any) => normalizeName(m.nom || '').includes(normTarget))

  // N'importe quelle erreur : repli sur get_player_sets_unaccent plutot que de
  // planter la section "Sets" pour TOUS les joueurs.
  const setsRpcRes = setsRpcRes0.error
    ? await supabase.rpc('get_player_sets_unaccent', { p_first: firstName, p_last: lastName })
    : setsRpcRes0

  let rawSets: any[] = setsRpcRes.data || []

  // Fallback si la RPC timeout (index trigram pas encore créé) :
  // requête simple avec limit — couvre les 1000 premières entrées
  if (setsRpcRes.error && !rawSets.length) {
    const fallbackRes = await supabase
      .from('card_set_entries')
      .select('set_id, variation, is_rc, player_name')
      .ilike('player_name', `${firstName}%`)
      .ilike('player_name', `%${lastName}%`)
      .limit(1000)
    const entries = (fallbackRes.data || []).filter((e: any) => normalizeName(e.player_name || '').includes(normTarget))
    const uniqueIds = [...new Set(entries.map((e: any) => e.set_id as number))]
    if (uniqueIds.length > 0) {
      const setsRes = await supabase.from('card_sets').select('id, name, year, brand, sport').in('id', uniqueIds)
      const setsById = new Map((setsRes.data || []).map((s: any) => [s.id, s]))
      const setsMap = new Map<number, any>()
      for (const e of entries) {
        const cs = setsById.get(e.set_id); if (!cs) continue
        if (!setsMap.has(cs.id)) setsMap.set(cs.id, { ...cs, is_rc: false, variations: [] })
        const s = setsMap.get(cs.id)!
        if (e.is_rc) s.is_rc = true
        if (e.variation && !s.variations.includes(e.variation)) s.variations.push(e.variation)
      }
      rawSets = [...setsMap.values()]
    }
  }

  // La RPC retourne déjà les sets dédupliqués avec is_rc et variations agrégés
  const sets = rawSets.map((s: any) => ({
    ...s,
    isRc: s.is_rc,
  })).sort((a: any, b: any) => (b.year || 0) - (a.year || 0))

  // RC year = année la PLUS ANCIENNE des sets marqués RC (pas la première trouvée)
  const rcSetYears = sets.filter((s: any) => s.isRc && s.year > 0).map((s: any) => s.year as number)
  const rcFromSets = rcSetYears.length > 0 ? Math.min(...rcSetYears) : undefined
  const manuRcYears = matchedManu.filter((m: any) => m.rc && m.annee).map((m: any) => parseInt(m.annee) || 0).filter((y: number) => y > 0)
  const rcFromManuelles = manuRcYears.length > 0 ? Math.min(...manuRcYears) : undefined
  const rcYear = rcFromSets && rcFromManuelles ? Math.min(rcFromSets, rcFromManuelles) : rcFromSets ?? rcFromManuelles

  // Le sport des sets sert de hint -- bio.sport (ESPN) est plus precis mais
  // bio n'est plus recupere ici (voir getCachedBio plus haut : deplace dans
  // les composants Suspense BioMeta/BioCareer pour ne plus bloquer le reste
  // de la page). photo + csv restent eager : la photo est en cache DB
  // (rapide, voir getCachedHeadshot), le csv est une donnee communaute, pas
  // une dependance ESPN lente.
  // sets[0] (set le plus RECENT) n'est pas fiable pour un joueur multi-sport
  // (ex: Michael Jordan a des sets "non-sport"/croisement NFL plus recents
  // que ses sets NBA) -- ca faisait chercher la photo ESPN dans le mauvais
  // sport et renvoyait un athlete homonyme different. On prend plutot le
  // sport le PLUS REPRESENTE parmi ses sets, en ignorant "non-sport" qui
  // n'est jamais une vraie categorie ESPN.
  const sportCounts = new Map<string, number>()
  for (const s of sets as any[]) {
    if (s.sport && s.sport !== 'non-sport') sportCounts.set(s.sport, (sportCounts.get(s.sport) || 0) + 1)
  }
  const primarySport = [...sportCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'nba'
  const [headshot, csvAll] = await Promise.all([
    getCachedHeadshot(playerName, primarySport),
    fetchCsvCardsForProfilesCached(profilesData),
  ])

  const manuellesCards = matchedManu.map((m: any) => ({
    id: m.id,
    img: m.image_recto,
    nom: m.nom,
    annee: m.annee,
    marque: m.marque,
    collection: m.collection,
    variation: m.variation || '',
    rc: m.rc || false,
    auto: m.auto || false,
    patch: m.patch || false,
    num: m.num || '',
    created_at: m.created_at || null,
    is_horizontal: m.is_horizontal,
    user_id: m.user_id,
    display_name: m.profiles?.display_name,
    avatar_url: m.profiles?.avatar_url,
    accent: m.profiles?.couleur_bordure || '#003DA6',
    disponible_vente: m.disponible_vente || false,
    source: 'manuel' as const,
    cardUrl: cardPageUrl(m.user_id, { nom: m.nom, annee: m.annee, marque: m.marque, collection: m.collection, image_recto: m.image_recto }),
  }))

  const csvCards = csvAll
    .filter(c => normalizeName(c.name).includes(normTarget))
    .map(c => ({
      id: `csv-${c.user_id}-${c.img}`,
      img: c.img,
      nom: c.name,
      annee: c.year,
      marque: c.brand,
      collection: '',
      variation: c.variant || '',
      rc: c.rc || false,
      auto: c.auto || false,
      patch: c.patch || false,
      num: c.num || '',
      is_horizontal: false,
      user_id: c.user_id,
      display_name: c.display_name,
      avatar_url: c.avatar_url,
      accent: c.accent,
      source: 'csv' as const,
      cardUrl: `/galerie/${c.user_id}`,
    }))

  const seen = new Set<string>()
  const communityCards = [...manuellesCards, ...csvCards].filter(c => {
    if (seen.has(c.img)) return false
    seen.add(c.img)
    return true
  })

  const uniqueCollectors = new Set(communityCards.map(c => c.user_id)).size

  const varCounts = new Map<string, number>()
  for (const c of communityCards) {
    if (c.variation && c.variation !== 'Base') {
      varCounts.set(c.variation, (varCounts.get(c.variation) || 0) + 1)
    }
  }
  const topVariations = [...varCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Derive extra sets from CSV files (brand + serie + year) and manual cards
  const csvPlayerRaw = csvAll.filter(c => normalizeName(c.name).includes(normTarget))
  const derivedSetsMap = new Map<string, { name: string; year: number; brand: string; isRc: boolean; variations: string[] }>()

  for (const c of csvPlayerRaw) {
    if (!c.brand && !c.serie) continue
    const setName = [c.brand, c.serie].filter(Boolean).join(' ')
    const yr = parseInt(c.year) || 0
    const key = `${yr}|${c.brand}|${c.serie}`
    if (!derivedSetsMap.has(key)) {
      derivedSetsMap.set(key, { name: setName, year: yr, brand: c.brand, isRc: c.rc, variations: c.variant ? [c.variant] : [] })
    } else {
      const e = derivedSetsMap.get(key)!
      if (c.rc) e.isRc = true
      if (c.variant && !e.variations.includes(c.variant)) e.variations.push(c.variant)
    }
  }

  for (const m of matchedManu) {
    if (!m.marque) continue
    const setName = [m.marque, m.collection].filter(Boolean).join(' ')
    const yr = parseInt(m.annee) || 0
    const key = `${yr}|${m.marque}|${m.collection || ''}`
    if (!derivedSetsMap.has(key)) {
      derivedSetsMap.set(key, { name: setName, year: yr, brand: m.marque || '', isRc: m.rc || false, variations: m.variation ? [m.variation] : [] })
    } else {
      const e = derivedSetsMap.get(key)!
      if (m.rc) e.isRc = true
    }
  }

  const extraSets = [...derivedSetsMap.values()].map((s, i) => ({
    id: -(i + 1),
    name: s.name,
    year: s.year,
    brand: s.brand,
    sport: primarySport,
    isRc: s.isRc,
    is_rc: s.isRc,
    variations: s.variations,
  }))
  const allSets = [...sets, ...extraSets].sort((a: any, b: any) => (b.year || 0) - (a.year || 0))

  return { playerName, sets: allSets, communityCards, rcYear, headshot, uniqueCollectors, topVariations, primarySport }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const playerName = slugToName(slug)
  const title = `${playerName} — Cartes de collection | Memorabilius`
  const desc = `Retrouvez toutes les cartes ${playerName} sur Memorabilius : sets Panini, Topps, Prizm, Hoops, Select et bien plus.`
  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { card: 'summary_large_image', title, description: desc },
  }
}

// ── Composants Suspense : fiche ESPN (bio) streamee apres le reste de la page ──
// Les 3 composants ci-dessous appellent getCachedBio() pour le meme joueur --
// cache() (React) dedup, un seul fetch ESPN reel pour les trois.

async function BioTeamLogo({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  if (!bio?.currentTeamLogo) return null
  const teamLogoUrl = `/api/team-logo?url=${encodeURIComponent(bio.currentTeamLogo)}`
  return (
    <img
      src={teamLogoUrl}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '-20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '340px',
        height: '340px',
        objectFit: 'contain',
        opacity: 0.18,
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, white 45%)',
        maskImage: 'linear-gradient(to right, transparent 0%, white 45%)',
        pointerEvents: 'none',
      }}
    />
  )
}

// Variante « bobblehead » : le logo d'équipe en filigrane est le même que dans « Équipes favorites » (TeamBadge), en très grand, rogné sur la droite du bandeau.
// Équipe de référence du bandeau : l'équipe actuelle pour un joueur en activité (ESPN lui donne une équipe), sinon celle où il a joué le PLUS de saisons
// (ex. Chicago pour Michael Jordan), avec le numéro qu'il y portait.
// Dernière année de saison qui doit figurer dans sa carrière pour qu'il soit « en activité » : l'année de fin de la saison en cours (la carrière ESPN
// indique les saisons NBA/NHL par leur année de fin : 2026-27 → 2027, qui commence en octobre) ; NFL et baseball : année de la saison.
function currentSeasonYear(sport: string, now = new Date()): number {
  const y = now.getFullYear(), m = now.getMonth() // m : 0 = janvier
  if (sport === 'nba' || sport === 'hockey') return m >= 9 ? y + 1 : y
  if (sport === 'nfl') return m >= 8 ? y : y - 1
  return m >= 2 ? y : y - 1
}
function heroTeamOf(bio: any, sport = 'nba'): { teamName: string; jersey: string | null; active: boolean } | null {
  const runs = bio?.career ? buildCareerTimeline(bio.career) : []
  if (!runs.length) return null
  // ESPN donne une « équipe actuelle » même à un retraité (Jordan → Wizards) : on juge sur la dernière saison jouée
  const active = runs[runs.length - 1].endYear >= currentSeasonYear(sport)
  let teamName = runs[runs.length - 1].teamName
  if (!active) {
    const seasons = new Map<string, number>()
    for (const r of runs) seasons.set(r.teamName, (seasons.get(r.teamName) || 0) + (r.endYear - r.startYear + 1))
    teamName = [...seasons.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }
  const jh = ((bio.jerseyHistory || []) as { teamName: string; startYear: number; jersey: string }[]).filter(h => h.teamName === teamName).sort((a, b) => b.startYear - a.startYear)
  const jersey = active ? (bio.jersey || null) : (jh[0]?.jersey || bio.jersey || null)
  return { teamName, jersey, active }
}

// ── Couleurs du bandeau d'après l'équipe de référence : fond sombre dans sa teinte, valeurs lisibles dessus ──
const hex2rgb = (h: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(h); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) as unknown as [number, number, number] : [0, 26, 77] }
const rgb2hex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mixc = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
const lumOf = (c: number[]) => { const v = c.map(x => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
const satOf = (c: number[]) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0 }
const contrast = (a: number[], b: number[]) => { const la = lumOf(a), lb = lumOf(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
function teamHeroColors(teamName: string): { from: string; to: string; accent: string } | null {
  const tc = (NBA_COLORS as Record<string, { primary: string; secondary: string }>)[teamName]
  if (!tc) return null
  const p = hex2rgb(tc.primary), s = hex2rgb(tc.secondary)
  const base = satOf(p) >= 0.25 && lumOf(p) > 0.01 ? p : (satOf(s) >= 0.25 ? s : p)
  const from = mixc(base, [0, 0, 0], 0.88), to = mixc(base, [0, 0, 0], 0.62)
  const mid = mixc(from, to, 0.5)
  // valeurs : la couleur secondaire si elle est vive et assez lisible, sinon la couleur principale éclaircie jusqu'à être lisible
  let accent: number[] = (satOf(s) >= 0.35 && lumOf(s) > 0.2 && contrast(s, mid) >= 4.5) ? s : base
  for (let t = 0; contrast(accent, mid) < 4.5 && t < 1; t += 0.05) accent = mixc(base, [255, 255, 255], t)
  return { from: rgb2hex(from), to: rgb2hex(to), accent: rgb2hex(accent) }
}
async function HeroTheme({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  const ht = heroTeamOf(bio, sportHint)
  const c = ht ? teamHeroColors(ht.teamName) : null
  if (!c) return null
  return <style>{`.jp-hero { --jp-hero-from: ${c.from}; --jp-hero-to: ${c.to}; }`}</style>
}

async function BioTeamWatermark({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  const runs = bio?.career ? buildCareerTimeline(bio.career) : []
  const ht = heroTeamOf(bio, sportHint)
  if (!ht || !runs.length) return null
  const leagueOf: Record<string, string> = { nba: 'nba', nfl: 'nfl', baseball: 'mlb', hockey: 'nhl' }
  const teamId = `${leagueOf[sportHint] || sportHint}:${getTeamColors(ht.teamName).abbr}`
  if (!getTeamById(teamId)) return null
  return (
    <div aria-hidden="true" className="jp-bobble-watermark" style={{
      position: 'absolute', right: -110, top: '50%', transform: 'translateY(-50%)', width: 640, height: 640, opacity: 0.24, pointerEvents: 'none',
      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, white 42%)', maskImage: 'linear-gradient(to right, transparent 0%, white 42%)',
    }}>
      <TeamBadge teamId={teamId} size={640} />
    </div>
  )
}

async function BioMeta({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  if (!bio) return null
  return (
    <>
      {(bio.position || bio.jersey || bio.height || bio.weight) && (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {bio.jersey && <span style={{ fontWeight: 800, fontSize: 16 }}>#{bio.jersey}</span>}
          {bio.position && <span>{bio.position}</span>}
          {(bio.position && (bio.height || bio.weight)) && <span style={{ opacity: 0.35 }}>·</span>}
          {bio.height && <span>{bio.height}</span>}
          {bio.weight && <span style={{ color: 'rgba(255,255,255,0.55)' }}>{bio.weight}</span>}
          {bio.nationality && <><span style={{ opacity: 0.35 }}>·</span><span>{bio.nationality}</span></>}
        </div>
      )}
      {(bio.birthDate || bio.birthPlace) && (
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
          🎂 {bio.birthDate && new Date(bio.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          {bio.birthPlace ? ` · ${bio.birthPlace}` : ''}
          {bio.age ? ` (${bio.age} ans)` : ''}
        </div>
      )}
    </>
  )
}

// Figurine : un joueur encore en activité (ESPN lui donne une équipe actuelle) porte le maillot de son équipe actuelle avec son numéro actuel ;
// un joueur retraité garde le maillot de sa fiche. La bio ESPN est mise en cache : pas d'appel réseau de plus.
async function BobbleFigure({ fig, playerName, sportHint }: { fig: BobbleFig; playerName: string; sportHint: string }) {
  let f = fig
  if (sportHint === 'nba') {
    const bio = await getCachedBio(playerName, sportHint)
    const ht = heroTeamOf(bio, sportHint)
    const body = ht ? teamBody(getTeamColors(ht.teamName).abbr, ht.jersey) : null
    if (body) f = { ...fig, body }
  }
  return <BobbleHero fig={f} name={playerName} height={430} />
}

// Variante « bobblehead » du bandeau : infos en grosses lettres (police des titres) et frise des équipes avec logos.
async function BioMetaBig({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  if (!bio) return null
  const squash = (v?: string | null) => (v || '').replace(/\s+/g, '')
  // Couleur des valeurs : celle de l'équipe actuelle (la première assez claire pour se lire sur le fond bleu nuit du bandeau, sinon blanc)
  const ht = heroTeamOf(bio, sportHint)
  const accent = (ht ? teamHeroColors(ht.teamName)?.accent : null) || '#ffffff'
  const cells = [['N°', (ht?.jersey || bio.jersey) ? `#${ht?.jersey || bio.jersey}` : ''], ['POSTE', bio.position || ''], ['TAILLE', squash(bio.height)], ['POIDS', squash(bio.weight)], ['ÂGE', bio.age ? `${bio.age} ANS` : '']].filter(c => c[1])
  const date = bio.birthDate ? stripDiacritics(new Date(bio.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })) : ''
  const birth = [date, bio.birthPlace ? stripDiacritics(bio.birthPlace) : ''].filter(Boolean).join(' · ')
  return (
    <div style={{ color: 'white' }}>
      {cells.length > 0 && (
        <div className="jp-meta-grid" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 'clamp(20px, 3.4vw, 44px)', rowGap: 10 }}>
          {cells.map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.14em', fontWeight: 700, opacity: 0.55 }}>{l}</div>
              <div className="da-display jp-bobble-meta" style={{ color: accent, lineHeight: 1.05 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {birth && <div className="da-display" style={{ marginTop: 10, fontSize: 14, letterSpacing: '0.08em', opacity: 0.7 }}>{birth}</div>}
    </div>
  )
}

async function BioCareerChips({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  const runs = bio?.career ? buildCareerTimeline(bio.career) : []
  if (runs.length === 0) return null
  const nba = sportHint === 'nba'
  // mêmes logos que « Équipes favorites » (composant TeamBadge) ; identifiant d'équipe « sport:ABR »
  const leagueOf: Record<string, string> = { nba: 'nba', nfl: 'nfl', baseball: 'mlb', hockey: 'nhl' }
  return (
    <div className="jp-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
      {runs.map((run, i) => {
        const colors = getTeamColors(run.teamName)
        const last = i === runs.length - 1
        const label = nba ? `${run.startYear - 1}–${run.endYear}` : (run.startYear === run.endYear ? String(run.startYear) : `${run.startYear}–${run.endYear}`)
        const teamId = `${leagueOf[sportHint] || sportHint}:${colors.abbr}`
        const known = !!getTeamById(teamId)
        return (
          <div key={`${run.teamName}-${run.startYear}-${i}`} title={`${run.teamName} · ${label}`} className="jp-chip"
            style={{ width: 82, flex: 'none', padding: '9px 4px 7px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              border: last ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.1)', background: last ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)' }}>
            {known
              ? <TeamBadge teamId={teamId} size={40} />
              : <JerseyIcon primary={colors.primary} secondary={colors.secondary} abbr={colors.abbr} number={undefined} sport={sportHint} />}
            <div style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{colors.abbr}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

async function BioCareer({ playerName, sportHint }: { playerName: string; sportHint: string }) {
  const bio = await getCachedBio(playerName, sportHint)
  const careerTimeline = bio?.career ? buildCareerTimeline(bio.career) : []
  if (!((bio?.honors && bio.honors.length > 0) || careerTimeline.length > 0)) return null
  return (
    <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      {/* Honors/Awards pills */}
      {bio?.honors && bio.honors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {bio.honors.map((honor: string, i: number) => {
            const isGold = /champion|most valuable|finals mvp|hall of fame|scoring title|75th|anniversary|finalist|roy|rookie of the year|defensive player/i.test(honor) &&
              !/all.?star|all.?nba|all.?defensive|all.?rookie/i.test(honor)
            return (
              <span key={i} style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 700,
                background: isGold ? 'rgba(255,199,44,0.22)' : 'rgba(255,255,255,0.12)',
                color: isGold ? '#FFC72C' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isGold ? 'rgba(255,199,44,0.35)' : 'rgba(255,255,255,0.18)'}`,
                padding: '4px 10px',
                borderRadius: 4,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}>{honor}</span>
            )
          })}
        </div>
      )}
      {/* Jersey icons timeline */}
      {careerTimeline.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          {careerTimeline.map((run, i) => {
            const colors = getTeamColors(run.teamName)
            const label = seasonLabel(run.startYear, run.endYear, sportHint)
            const jerseyNumber =
              bio?.jerseyHistory?.find((h: { teamName: string; startYear: number; jersey: string }) => h.teamName === run.teamName && h.startYear === run.startYear)?.jersey
              ?? bio?.jersey ?? undefined
            return (
              <div
                key={`${run.teamName}-${run.startYear}-${i}`}
                title={`${run.teamName} · ${label}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}
              >
                <JerseyIcon primary={colors.primary} secondary={colors.secondary} abbr={colors.abbr} number={jerseyNumber} sport={sportHint} />
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.2 }}>
                  {colors.abbr}
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default async function JoueurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { playerName, sets, communityCards, rcYear, headshot, uniqueCollectors, topVariations, primarySport } = await fetchPlayer(slug)
  const fig = bobbleFor(playerName)           // figurine validée (tête OK + corps d'équipe + numéro), sinon null
  const bobbleId = fig ? fig.id : null
  const newHero = true                        // nouveau style de bandeau pour tous les joueurs ; photo à la place de la figurine tant qu'il n'y en a pas

  const sportsFromSets = [...new Set(sets.map((s: any) => s.sport).filter(Boolean))] as string[]
  const sports = sportsFromSets.length > 0 ? sportsFromSets : (primarySport ? [primarySport] : [])
  // bio (ESPN) n'est plus recupere ici -- voir BioMeta/BioCareer plus bas,
  // qui la chargent eux-memes en stream (Suspense). Le JSON-LD se passe donc
  // de birthDate/birthPlace (minime pour le SEO) plutot que d'attendre ESPN.
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: playerName,
    url: `https://www.memorabilius.fr/joueur/${slug}`,
    description: `${sets.length} sets de cartes · ${communityCards.length} cartes en communauté`,
    ...(headshot ? { image: headshot } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Setlist', item: 'https://www.memorabilius.fr/setlist' },
      { '@type': 'ListItem', position: 2, name: playerName, item: `https://www.memorabilius.fr/joueur/${slug}` },
    ],
  }

  if (sets.length === 0 && communityCards.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 16px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>{stripDiacritics(playerName)}</h1>
        <p style={{ color: '#999', fontSize: 15, marginBottom: 24 }}>Aucune carte trouvée pour ce joueur dans notre base.</p>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, textDecoration: 'none' }}>← Voir le Setlist</Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root {
          --jp-bg: #f4f6fb;
          --jp-surface: #ffffff;
          --jp-surface2: #f8f9fc;
          --jp-text: #111111;
          --jp-text2: #555555;
          --jp-muted: #888888;
          --jp-border: #e8eaf0;
          --jp-accent: #003DA6;
          --jp-hero-from: #001a4d;
          --jp-hero-to: #0048c8;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --jp-bg: #0d0f14;
            --jp-surface: #161a24;
            --jp-surface2: #1e2232;
            --jp-text: #f0f2f8;
            --jp-text2: #b0b8cc;
            --jp-muted: #666e88;
            --jp-border: #252a3a;
            --jp-accent: #4d82ff;
            --jp-hero-from: #000a1f;
            --jp-hero-to: #001a5c;
          }
        }
        :root[data-theme="dark"] {
          --jp-bg: #0d0f14;
          --jp-surface: #161a24;
          --jp-surface2: #1e2232;
          --jp-text: #f0f2f8;
          --jp-text2: #b0b8cc;
          --jp-muted: #666e88;
          --jp-border: #252a3a;
          --jp-accent: #4d82ff;
          --jp-hero-from: #000a1f;
          --jp-hero-to: #001a5c;
        }
        :root[data-theme="light"] {
          --jp-bg: #f4f6fb;
          --jp-surface: #ffffff;
          --jp-surface2: #f8f9fc;
          --jp-text: #111111;
          --jp-text2: #555555;
          --jp-muted: #888888;
          --jp-border: #e8eaf0;
          --jp-accent: #003DA6;
          --jp-hero-from: #001a4d;
          --jp-hero-to: #0048c8;
        }
        .jp-card-hover { transition: transform 0.15s, box-shadow 0.15s; }
        .jp-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.14); }
        .jp-set-hover:hover { border-color: var(--jp-accent) !important; background: var(--jp-surface2) !important; }
        .jp-hero-h1 { font-size: 42px; }
        .jp-sets-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .jp-hero-overflow { overflow: hidden; }
        .jp-hero-h1.jp-bobble-h1 { font-size: clamp(54px, 9.2vw, 132px); font-weight: 400; line-height: 0.88; letter-spacing: 0.01em; }
        .jp-bobble-meta { font-size: clamp(22px, 3vw, 40px); }
        @media (max-width: 760px) { .jp-bobble-watermark { width: 380px !important; height: 380px !important; right: -90px !important; } }
        @media (max-width: 760px) { .jp-bobble-wrap { zoom: 0.68; margin: -40px 0 -40px -12px; } .jp-hero-row { justify-content: center; gap: 14px !important; } }
        @media (max-width: 600px) {
          /* même disposition que sur ordinateur (figurine à gauche, infos à droite), en plus petit ; la frise des équipes passe en dessous sur toute la largeur */
          .jp-hero-row { display: grid !important; grid-template-columns: auto minmax(0, 1fr); column-gap: 12px !important; row-gap: 0 !important; align-items: start !important; }
          .jp-bobble-wrap { zoom: 0.55; margin: 0 !important; grid-column: 1; grid-row: 1 / span 4; align-self: center; }
          .jp-hero-row > div:last-child { display: contents !important; }
          .jp-hero-row > div:last-child > div.da-display { grid-column: 2; font-size: 15px !important; gap: 10px !important; margin-top: 4px; }
          .jp-hero-h1.jp-bobble-h1 { grid-column: 2; font-size: clamp(23px, 7vw, 28px); margin: 2px 0 8px !important; }
          .jp-hero-row > div:last-child > div:not(.da-display):not(.jp-chips) { grid-column: 2; min-width: 0; }
          .jp-meta-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px !important; }
          .jp-meta-grid .jp-bobble-meta { font-size: 17px; }
          .jp-meta-grid > div > div:first-child { font-size: 9px !important; }
          .jp-meta-grid + div { font-size: 10.5px !important; margin-top: 6px !important; }
          .jp-chips { grid-column: 2; min-width: 0; flex-wrap: wrap !important; overflow: visible; margin: 8px 0 0 !important; padding: 0; gap: 4px !important; }
          .jp-chips::-webkit-scrollbar { display: none; }
          .jp-chip { width: 62px !important; padding: 6px 2px 5px !important; zoom: 0.48; }
        }
        @media (max-width: 600px) {
          .jp-hero-h1 { font-size: 26px; }
          .jp-sets-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />

      {/* Full-bleed container — breaks out of layout.tsx's maxWidth/padding */}
      <div style={{
        background: 'var(--jp-bg)',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
        marginLeft: 'calc(50% - 50vw)',
        width: '100vw',
        marginTop: '-20px',
      }}>

        {/* ── HERO ── */}
        <div className="jp-hero" style={{
          background: 'linear-gradient(135deg, var(--jp-hero-from) 0%, var(--jp-hero-to) 100%)',
          color: 'white',
          padding: newHero ? '34px 24px 22px' : '44px 24px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Couleurs du bandeau = celles de l'équipe de référence (voir HeroTheme) */}
          <Suspense fallback={null}><HeroTheme playerName={playerName} sportHint={primarySport} /></Suspense>
          {/* Team logo watermark -- depend de bio (ESPN), voir BioTeamLogo plus bas */}
          <Suspense fallback={null}>
            {bobbleId
              ? <BioTeamWatermark playerName={playerName} sportHint={primarySport} />
              : <BioTeamWatermark playerName={playerName} sportHint={primarySport} />}
          </Suspense>

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            {/* Breadcrumb */}
            {!newHero && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 22, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Link href="/setlist" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 600, transition: 'color 0.1s' }}>Setlist</Link>
              <span>/</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{playerName}</span>
            </div>}

            <div className="jp-hero-row" style={{ display: 'flex', gap: newHero ? 28 : 32, alignItems: newHero ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
              {/* Bobblehead (si le joueur en a un) à la place de la photo ronde */}
              {fig
                ? <div className="jp-bobble-wrap"><Suspense fallback={<div style={{ width: 260, height: 430 }} />}><BobbleFigure fig={fig} playerName={playerName} sportHint={primarySport} /></Suspense></div>
                : headshot && (
                  <div className="jp-bobble-wrap" style={{ flexShrink: 0, width: 340, maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
                    <img src={headshot} alt={playerName} style={{ width: 340, maxWidth: '100%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,.4))' }} />
                  </div>
                )}
              {/* Headshot */}
              {!newHero && headshot && (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={headshot}
                    alt={playerName}
                    style={{
                      width: 150,
                      height: 150,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      border: '3px solid rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
              )}

              {newHero ? (
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="da-display" style={{ fontSize: 30, lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
                    <span style={{ opacity: 0.85 }}>{(primarySport || 'nba').toUpperCase()}</span>
                    {rcYear && <span style={{ color: '#e67e22' }}>RC {rcYear}</span>}
                  </div>
                  <h1 className="jp-hero-h1 jp-bobble-h1 da-display" style={{ margin: '2px 0 14px' }}>{stripDiacritics(playerName)}</h1>
                  <Suspense fallback={null}>
                    <BioMetaBig playerName={playerName} sportHint={primarySport} />
                  </Suspense>
                  <Suspense fallback={null}>
                    <BioCareerChips playerName={playerName} sportHint={primarySport} />
                  </Suspense>
                </div>
              ) : (
              <div style={{ flex: 1, minWidth: 220 }}>
                {/* Sport pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {sports.map((s: string) => (
                    <span key={s} style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '3px 9px', letterSpacing: '0.06em' }}>
                      {SPORT_LABELS[s] || s.toUpperCase()}
                    </span>
                  ))}
                </div>

                <h1 className="jp-hero-h1" style={{ fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' as any }}>{stripDiacritics(playerName)}</h1>

                {/* Position/taille/poids + naissance -- depend de bio (ESPN), voir BioMeta plus bas */}
                <Suspense fallback={null}>
                  <BioMeta playerName={playerName} sportHint={primarySport} />
                </Suspense>

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rcYear && (
                    <span style={{ fontSize: 12, background: '#e67e22', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 800 }}>
                      RC {rcYear}
                    </span>
                  )}
                  {sets.length > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      {sets.length} set{sets.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {communityCards.length > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      {communityCards.length} carte{communityCards.length > 1 ? 's' : ''} communauté
                    </span>
                  )}
                  {uniqueCollectors > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      👥 {uniqueCollectors} collectionneur{uniqueCollectors > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* ── CARRIÈRE dans le hero (BBRef style) -- depend de bio (ESPN), voir BioCareer plus bas ── */}
            {!newHero && (
              <Suspense fallback={null}>
                <BioCareer playerName={playerName} sportHint={primarySport} />
              </Suspense>
            )}
          </div>
        </div>

        {/* ── CONTENU ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 48px' }}>

          {/* Top variations dans la communauté */}
          {topVariations.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--jp-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
                Parallèles les plus collectés
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topVariations.map(([v, count]: [string, number]) => (
                  <span key={v} style={{ fontSize: 12, fontWeight: 700, background: 'var(--jp-surface)', border: '1.5px solid var(--jp-border)', color: 'var(--jp-text2)', borderRadius: 20, padding: '5px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {v}
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--jp-accent)', background: 'rgba(0,61,166,0.08)', borderRadius: 10, padding: '1px 6px' }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cartes de la communauté */}
          {communityCards.length > 0 && (
            <CommunityCardsSection
              playerName={playerName}
              initialCards={communityCards.slice(0, 48) as any}
              totalCount={communityCards.length}
              totalCollectors={uniqueCollectors}
              hasAuto={communityCards.some((c: any) => c.auto)}
              hasPatch={communityCards.some((c: any) => c.patch)}
              hasNum={communityCards.some((c: any) => !!c.num)}
              hasVente={communityCards.some((c: any) => c.disponible_vente)}
            />
          )}

          {/* Checklist personnelle */}
          <LazySection id="checklist-joueur" title="Checklist" hint="cliquer pour ouvrir"><PlayerChecklistSection playerName={playerName} /></LazySection>
          <ScrollTopButton />

          {/* Sets groupés par année -- pagine au defilement (voir PlayerSetsSection),
              un joueur peut avoir des centaines/milliers de sets meme sans etre
              tres collectionne (catalogue historique independant des cartes
              communaute), et les rendre tous d'un coup cote serveur etait lent. */}
          <PlayerSetsSection
            playerName={playerName}
            initialSets={[]}
            totalCount={sets.length}
            primarySport={primarySport}
          />

        </div>
      </div>
    </>
  )
}
