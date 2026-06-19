export type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl'

export interface SportsTeam {
  id: string        // format "nba:LAL"
  sport: Sport
  abbr: string
  name: string
  color: string
}

// ESPN CDN logo URL
export const teamLogoUrl = (sport: Sport, abbr: string) =>
  `https://a.espncdn.com/i/teamlogos/${sport}/500/${abbr.toLowerCase()}.png`

export const SPORTS_TEAMS: SportsTeam[] = [
  // NBA
  { id: 'nba:ATL', sport: 'nba', abbr: 'ATL', name: 'Atlanta Hawks',           color: '#E03A3E' },
  { id: 'nba:BOS', sport: 'nba', abbr: 'BOS', name: 'Boston Celtics',           color: '#007A33' },
  { id: 'nba:BKN', sport: 'nba', abbr: 'BKN', name: 'Brooklyn Nets',            color: '#000000' },
  { id: 'nba:CHA', sport: 'nba', abbr: 'CHA', name: 'Charlotte Hornets',        color: '#00788C' },
  { id: 'nba:CHI', sport: 'nba', abbr: 'CHI', name: 'Chicago Bulls',            color: '#CE1141' },
  { id: 'nba:CLE', sport: 'nba', abbr: 'CLE', name: 'Cleveland Cavaliers',      color: '#860038' },
  { id: 'nba:DAL', sport: 'nba', abbr: 'DAL', name: 'Dallas Mavericks',         color: '#00538C' },
  { id: 'nba:DEN', sport: 'nba', abbr: 'DEN', name: 'Denver Nuggets',           color: '#0E2240' },
  { id: 'nba:DET', sport: 'nba', abbr: 'DET', name: 'Detroit Pistons',          color: '#C8102E' },
  { id: 'nba:GSW', sport: 'nba', abbr: 'GSW', name: 'Golden State Warriors',    color: '#1D428A' },
  { id: 'nba:HOU', sport: 'nba', abbr: 'HOU', name: 'Houston Rockets',          color: '#CE1141' },
  { id: 'nba:IND', sport: 'nba', abbr: 'IND', name: 'Indiana Pacers',           color: '#002D62' },
  { id: 'nba:LAC', sport: 'nba', abbr: 'LAC', name: 'LA Clippers',              color: '#C8102E' },
  { id: 'nba:LAL', sport: 'nba', abbr: 'LAL', name: 'Los Angeles Lakers',       color: '#552583' },
  { id: 'nba:MEM', sport: 'nba', abbr: 'MEM', name: 'Memphis Grizzlies',        color: '#5D76A9' },
  { id: 'nba:MIA', sport: 'nba', abbr: 'MIA', name: 'Miami Heat',               color: '#98002E' },
  { id: 'nba:MIL', sport: 'nba', abbr: 'MIL', name: 'Milwaukee Bucks',          color: '#00471B' },
  { id: 'nba:MIN', sport: 'nba', abbr: 'MIN', name: 'Minnesota Timberwolves',   color: '#0C2340' },
  { id: 'nba:NOP', sport: 'nba', abbr: 'NOP', name: 'New Orleans Pelicans',     color: '#0C2340' },
  { id: 'nba:NYK', sport: 'nba', abbr: 'NYK', name: 'New York Knicks',          color: '#006BB6' },
  { id: 'nba:OKC', sport: 'nba', abbr: 'OKC', name: 'Oklahoma City Thunder',    color: '#007AC1' },
  { id: 'nba:ORL', sport: 'nba', abbr: 'ORL', name: 'Orlando Magic',            color: '#0077C0' },
  { id: 'nba:PHI', sport: 'nba', abbr: 'PHI', name: 'Philadelphia 76ers',       color: '#006BB6' },
  { id: 'nba:PHX', sport: 'nba', abbr: 'PHX', name: 'Phoenix Suns',             color: '#1D1160' },
  { id: 'nba:POR', sport: 'nba', abbr: 'POR', name: 'Portland Trail Blazers',   color: '#E03A3E' },
  { id: 'nba:SAC', sport: 'nba', abbr: 'SAC', name: 'Sacramento Kings',         color: '#5A2D81' },
  { id: 'nba:SAS', sport: 'nba', abbr: 'SAS', name: 'San Antonio Spurs',        color: '#8A8D8F' },
  { id: 'nba:TOR', sport: 'nba', abbr: 'TOR', name: 'Toronto Raptors',          color: '#CE1141' },
  { id: 'nba:UTA', sport: 'nba', abbr: 'UTA', name: 'Utah Jazz',                color: '#002B5C' },
  { id: 'nba:WAS', sport: 'nba', abbr: 'WAS', name: 'Washington Wizards',       color: '#E31837' },

  // NFL
  { id: 'nfl:ARI', sport: 'nfl', abbr: 'ARI', name: 'Arizona Cardinals',        color: '#97233F' },
  { id: 'nfl:ATL', sport: 'nfl', abbr: 'ATL', name: 'Atlanta Falcons',          color: '#A71930' },
  { id: 'nfl:BAL', sport: 'nfl', abbr: 'BAL', name: 'Baltimore Ravens',         color: '#241773' },
  { id: 'nfl:BUF', sport: 'nfl', abbr: 'BUF', name: 'Buffalo Bills',            color: '#00338D' },
  { id: 'nfl:CAR', sport: 'nfl', abbr: 'CAR', name: 'Carolina Panthers',        color: '#0085CA' },
  { id: 'nfl:CHI', sport: 'nfl', abbr: 'CHI', name: 'Chicago Bears',            color: '#0B162A' },
  { id: 'nfl:CIN', sport: 'nfl', abbr: 'CIN', name: 'Cincinnati Bengals',       color: '#FB4F14' },
  { id: 'nfl:CLE', sport: 'nfl', abbr: 'CLE', name: 'Cleveland Browns',         color: '#311D00' },
  { id: 'nfl:DAL', sport: 'nfl', abbr: 'DAL', name: 'Dallas Cowboys',           color: '#003594' },
  { id: 'nfl:DEN', sport: 'nfl', abbr: 'DEN', name: 'Denver Broncos',           color: '#FB4F14' },
  { id: 'nfl:DET', sport: 'nfl', abbr: 'DET', name: 'Detroit Lions',            color: '#0076B6' },
  { id: 'nfl:GB',  sport: 'nfl', abbr: 'GB',  name: 'Green Bay Packers',        color: '#203731' },
  { id: 'nfl:HOU', sport: 'nfl', abbr: 'HOU', name: 'Houston Texans',           color: '#03202F' },
  { id: 'nfl:IND', sport: 'nfl', abbr: 'IND', name: 'Indianapolis Colts',       color: '#002C5F' },
  { id: 'nfl:JAX', sport: 'nfl', abbr: 'JAX', name: 'Jacksonville Jaguars',     color: '#006778' },
  { id: 'nfl:KC',  sport: 'nfl', abbr: 'KC',  name: 'Kansas City Chiefs',       color: '#E31837' },
  { id: 'nfl:LAC', sport: 'nfl', abbr: 'LAC', name: 'Los Angeles Chargers',     color: '#0080C6' },
  { id: 'nfl:LAR', sport: 'nfl', abbr: 'LAR', name: 'Los Angeles Rams',         color: '#003594' },
  { id: 'nfl:LV',  sport: 'nfl', abbr: 'LV',  name: 'Las Vegas Raiders',        color: '#000000' },
  { id: 'nfl:MIA', sport: 'nfl', abbr: 'MIA', name: 'Miami Dolphins',           color: '#008E97' },
  { id: 'nfl:MIN', sport: 'nfl', abbr: 'MIN', name: 'Minnesota Vikings',        color: '#4F2683' },
  { id: 'nfl:NE',  sport: 'nfl', abbr: 'NE',  name: 'New England Patriots',     color: '#002244' },
  { id: 'nfl:NO',  sport: 'nfl', abbr: 'NO',  name: 'New Orleans Saints',       color: '#D3BC8D' },
  { id: 'nfl:NYG', sport: 'nfl', abbr: 'NYG', name: 'New York Giants',          color: '#0B2265' },
  { id: 'nfl:NYJ', sport: 'nfl', abbr: 'NYJ', name: 'New York Jets',            color: '#125740' },
  { id: 'nfl:PHI', sport: 'nfl', abbr: 'PHI', name: 'Philadelphia Eagles',      color: '#004C54' },
  { id: 'nfl:PIT', sport: 'nfl', abbr: 'PIT', name: 'Pittsburgh Steelers',      color: '#FFB612' },
  { id: 'nfl:SEA', sport: 'nfl', abbr: 'SEA', name: 'Seattle Seahawks',         color: '#002244' },
  { id: 'nfl:SF',  sport: 'nfl', abbr: 'SF',  name: 'San Francisco 49ers',      color: '#AA0000' },
  { id: 'nfl:TB',  sport: 'nfl', abbr: 'TB',  name: 'Tampa Bay Buccaneers',     color: '#D50A0A' },
  { id: 'nfl:TEN', sport: 'nfl', abbr: 'TEN', name: 'Tennessee Titans',         color: '#0C2340' },
  { id: 'nfl:WSH', sport: 'nfl', abbr: 'WSH', name: 'Washington Commanders',    color: '#5A1414' },

  // MLB
  { id: 'mlb:ARI', sport: 'mlb', abbr: 'ARI', name: 'Arizona Diamondbacks',     color: '#A71930' },
  { id: 'mlb:ATL', sport: 'mlb', abbr: 'ATL', name: 'Atlanta Braves',           color: '#CE1141' },
  { id: 'mlb:BAL', sport: 'mlb', abbr: 'BAL', name: 'Baltimore Orioles',        color: '#DF4601' },
  { id: 'mlb:BOS', sport: 'mlb', abbr: 'BOS', name: 'Boston Red Sox',           color: '#BD3039' },
  { id: 'mlb:CHC', sport: 'mlb', abbr: 'CHC', name: 'Chicago Cubs',             color: '#0E3386' },
  { id: 'mlb:CWS', sport: 'mlb', abbr: 'CWS', name: 'Chicago White Sox',        color: '#27251F' },
  { id: 'mlb:CIN', sport: 'mlb', abbr: 'CIN', name: 'Cincinnati Reds',          color: '#C6011F' },
  { id: 'mlb:CLE', sport: 'mlb', abbr: 'CLE', name: 'Cleveland Guardians',      color: '#00385D' },
  { id: 'mlb:COL', sport: 'mlb', abbr: 'COL', name: 'Colorado Rockies',         color: '#333366' },
  { id: 'mlb:DET', sport: 'mlb', abbr: 'DET', name: 'Detroit Tigers',           color: '#0C2340' },
  { id: 'mlb:HOU', sport: 'mlb', abbr: 'HOU', name: 'Houston Astros',           color: '#002D62' },
  { id: 'mlb:KC',  sport: 'mlb', abbr: 'KC',  name: 'Kansas City Royals',       color: '#004687' },
  { id: 'mlb:LAA', sport: 'mlb', abbr: 'LAA', name: 'Los Angeles Angels',       color: '#BA0021' },
  { id: 'mlb:LAD', sport: 'mlb', abbr: 'LAD', name: 'Los Angeles Dodgers',      color: '#005A9C' },
  { id: 'mlb:MIA', sport: 'mlb', abbr: 'MIA', name: 'Miami Marlins',            color: '#00A3E0' },
  { id: 'mlb:MIL', sport: 'mlb', abbr: 'MIL', name: 'Milwaukee Brewers',        color: '#12284B' },
  { id: 'mlb:MIN', sport: 'mlb', abbr: 'MIN', name: 'Minnesota Twins',          color: '#002B5C' },
  { id: 'mlb:NYM', sport: 'mlb', abbr: 'NYM', name: 'New York Mets',            color: '#002D72' },
  { id: 'mlb:NYY', sport: 'mlb', abbr: 'NYY', name: 'New York Yankees',         color: '#003087' },
  { id: 'mlb:OAK', sport: 'mlb', abbr: 'OAK', name: 'Athletics',               color: '#003831' },
  { id: 'mlb:PHI', sport: 'mlb', abbr: 'PHI', name: 'Philadelphia Phillies',    color: '#E81828' },
  { id: 'mlb:PIT', sport: 'mlb', abbr: 'PIT', name: 'Pittsburgh Pirates',       color: '#27251F' },
  { id: 'mlb:SD',  sport: 'mlb', abbr: 'SD',  name: 'San Diego Padres',         color: '#2F241D' },
  { id: 'mlb:SEA', sport: 'mlb', abbr: 'SEA', name: 'Seattle Mariners',         color: '#0C2C56' },
  { id: 'mlb:SF',  sport: 'mlb', abbr: 'SF',  name: 'San Francisco Giants',     color: '#FD5A1E' },
  { id: 'mlb:STL', sport: 'mlb', abbr: 'STL', name: 'St. Louis Cardinals',      color: '#C41E3A' },
  { id: 'mlb:TB',  sport: 'mlb', abbr: 'TB',  name: 'Tampa Bay Rays',           color: '#092C5C' },
  { id: 'mlb:TEX', sport: 'mlb', abbr: 'TEX', name: 'Texas Rangers',            color: '#003278' },
  { id: 'mlb:TOR', sport: 'mlb', abbr: 'TOR', name: 'Toronto Blue Jays',        color: '#134A8E' },
  { id: 'mlb:WSH', sport: 'mlb', abbr: 'WSH', name: 'Washington Nationals',     color: '#AB0003' },

  // NHL
  { id: 'nhl:ANA', sport: 'nhl', abbr: 'ANA', name: 'Anaheim Ducks',            color: '#F47A38' },
  { id: 'nhl:BOS', sport: 'nhl', abbr: 'BOS', name: 'Boston Bruins',            color: '#FCB514' },
  { id: 'nhl:BUF', sport: 'nhl', abbr: 'BUF', name: 'Buffalo Sabres',           color: '#003087' },
  { id: 'nhl:CGY', sport: 'nhl', abbr: 'CGY', name: 'Calgary Flames',           color: '#C8102E' },
  { id: 'nhl:CAR', sport: 'nhl', abbr: 'CAR', name: 'Carolina Hurricanes',      color: '#CC0000' },
  { id: 'nhl:CHI', sport: 'nhl', abbr: 'CHI', name: 'Chicago Blackhawks',       color: '#CF0A2C' },
  { id: 'nhl:COL', sport: 'nhl', abbr: 'COL', name: 'Colorado Avalanche',       color: '#6F263D' },
  { id: 'nhl:CBJ', sport: 'nhl', abbr: 'CBJ', name: 'Columbus Blue Jackets',    color: '#002654' },
  { id: 'nhl:DAL', sport: 'nhl', abbr: 'DAL', name: 'Dallas Stars',             color: '#006847' },
  { id: 'nhl:DET', sport: 'nhl', abbr: 'DET', name: 'Detroit Red Wings',        color: '#CE1126' },
  { id: 'nhl:EDM', sport: 'nhl', abbr: 'EDM', name: 'Edmonton Oilers',          color: '#FF4C00' },
  { id: 'nhl:FLA', sport: 'nhl', abbr: 'FLA', name: 'Florida Panthers',         color: '#C8102E' },
  { id: 'nhl:LA',  sport: 'nhl', abbr: 'LA',  name: 'Los Angeles Kings',        color: '#111111' },
  { id: 'nhl:MIN', sport: 'nhl', abbr: 'MIN', name: 'Minnesota Wild',           color: '#154734' },
  { id: 'nhl:MTL', sport: 'nhl', abbr: 'MTL', name: 'Montréal Canadiens',       color: '#AF1E2D' },
  { id: 'nhl:NSH', sport: 'nhl', abbr: 'NSH', name: 'Nashville Predators',      color: '#FFB81C' },
  { id: 'nhl:NJ',  sport: 'nhl', abbr: 'NJ',  name: 'New Jersey Devils',        color: '#CE1126' },
  { id: 'nhl:NYI', sport: 'nhl', abbr: 'NYI', name: 'New York Islanders',       color: '#00539B' },
  { id: 'nhl:NYR', sport: 'nhl', abbr: 'NYR', name: 'New York Rangers',         color: '#0038A8' },
  { id: 'nhl:OTT', sport: 'nhl', abbr: 'OTT', name: 'Ottawa Senators',          color: '#C52032' },
  { id: 'nhl:PHI', sport: 'nhl', abbr: 'PHI', name: 'Philadelphia Flyers',      color: '#F74902' },
  { id: 'nhl:PIT', sport: 'nhl', abbr: 'PIT', name: 'Pittsburgh Penguins',      color: '#FCB514' },
  { id: 'nhl:SJS', sport: 'nhl', abbr: 'SJS', name: 'San Jose Sharks',          color: '#006D75' },
  { id: 'nhl:SEA', sport: 'nhl', abbr: 'SEA', name: 'Seattle Kraken',           color: '#001628' },
  { id: 'nhl:STL', sport: 'nhl', abbr: 'STL', name: 'St. Louis Blues',          color: '#002F87' },
  { id: 'nhl:TB',  sport: 'nhl', abbr: 'TB',  name: 'Tampa Bay Lightning',      color: '#002868' },
  { id: 'nhl:TOR', sport: 'nhl', abbr: 'TOR', name: 'Toronto Maple Leafs',      color: '#00205B' },
  { id: 'nhl:UTA', sport: 'nhl', abbr: 'UTA', name: 'Utah Hockey Club',         color: '#6CACE4' },
  { id: 'nhl:VAN', sport: 'nhl', abbr: 'VAN', name: 'Vancouver Canucks',        color: '#00843D' },
  { id: 'nhl:VGK', sport: 'nhl', abbr: 'VGK', name: 'Vegas Golden Knights',     color: '#B4975A' },
  { id: 'nhl:WSH', sport: 'nhl', abbr: 'WSH', name: 'Washington Capitals',      color: '#CF0A2C' },
  { id: 'nhl:WPG', sport: 'nhl', abbr: 'WPG', name: 'Winnipeg Jets',            color: '#041E42' },
]

export const SPORT_LABELS: Record<Sport, string> = { nba: '🏀 NBA', nfl: '🏈 NFL', mlb: '⚾ MLB', nhl: '🏒 NHL' }

export function getTeamById(id: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => t.id === id) || null
}

// Backward compat: find NBA team by abbr only
export function getTeam(abbr: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === abbr) || null
}

export function getSpeciality(
  stats: { total: number; rc: number; auto: number; patch: number; num: number } | undefined,
  favoriteTeams?: string[] | null
): { label: string; color: string } | null {
  if (!stats || stats.total === 0) return null
  const { total, rc, auto, patch, num } = stats
  if (total >= 1000)        return { label: '🏆 Légende',             color: '#f39c12' }
  if (total >= 300)         return { label: '🎖️ Grand Collectionneur', color: '#e67e22' }
  if (rc / total > 0.35)   return { label: '🌟 RC Hunter',            color: '#e67e22' }
  if (auto / total > 0.25) return { label: '✍️ Auto Collector',       color: '#2e7d32' }
  if (patch / total > 0.12)return { label: '🧩 Patch Master',         color: '#1976d2' }
  if (num / total > 0.55)  return { label: '🔢 Serial #',             color: '#7b1fa2' }
  if (total >= 100)         return { label: '📦 Collectionneur',       color: '#003DA6' }
  return null
}
