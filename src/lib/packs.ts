// Packs : règles du jeu (partagées entre le serveur qui tire les cartes et la page qui les affiche).
export type Rarity = 1 | 2 | 3 | 4 | 5

export const RARITY_NAME: Record<Rarity, string> = { 1: 'Commune', 2: 'Peu commune', 3: 'Rare', 4: 'Épique', 5: 'Légendaire' }
export const RARITY_RULE: Record<Rarity, string> = {
  1: 'Carte de base',
  2: 'Base rookie (RC), ou insert simple',
  3: 'Numérotée, patch, ou rookie en insert',
  4: 'Signée, ou deux critères parmi signée, patch, numérotée, RC',
  5: 'Numérotée sous /15 (/10, /5, /1…)',
}
export const RARITY_COLOR: Record<Rarity, string> = { 1: '#8aa0c8', 2: '#3ddc84', 3: '#3b8bff', 4: '#b44cff', 5: '#ffc928' }

// Chance qu'une carte soit de cette rareté (avant garanties) — somme = 100
export const BASE_ODDS: Record<Rarity, number> = { 1: 60, 2: 25, 3: 10, 4: 4, 5: 1 }
// Un pack gagné toutes les heures, 10 en réserve au maximum
export const PACK_MAX = 10
export const PACK_EVERY_MIN = 60
// Pack : 6 cartes, dont 1 rare ou mieux garantie
export const PACK_CARDS = 6
export const PACK_GUARANTEE: Rarity = 3
// … et toujours au moins 2 cartes communes (cartes de base)
export const PACK_COMMONS = 2
// … et jamais plus de 4 communes
export const PACK_MAX_COMMONS = 4
// Après autant de packs sans carte épique ou mieux, le suivant en contient une à coup sûr
export const PITY_LIMIT = 10

export type PackCard = {
  id: number; setId: number; rarity: Rarity; player: string; team: string | null; number: string | null; variation: string | null
  rc: boolean; auto: boolean; patch?: boolean; isNew?: boolean; owned?: number; run?: number | null; img: string; set: string | null; year: number | null; brand: string | null; sport: string | null; credit?: string | null
}

// ── Éditions du pack (le dessin change selon la date) et week-end bonus ──
export type PackThemeId = 'classic' | 'gold' | 'winter' | 'playoffs' | 'rookie'
export const THEME_NAME: Record<PackThemeId, string> = { classic: 'Édition classique', gold: 'Édition Légendes · week-end bonus', winter: 'Édition Hiver', playoffs: 'Édition Playoffs', rookie: 'Édition Rookie' }
const parisParts = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', month: 'numeric', day: 'numeric' }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)?.value || ''
  return { wd: g('weekday'), m: Number(g('month')), day: Number(g('day')) }
}
// week-end (samedi, dimanche, heure de Paris) : un pack toutes les 30 minutes au lieu de 60
export const isWeekendBonus = (d = new Date()) => { const w = parisParts(d).wd; return w === 'Sat' || w === 'Sun' }
export const PACK_EVERY_MIN_WEEKEND = 30
export function packTheme(d = new Date()): PackThemeId {
  if (isWeekendBonus(d)) return 'gold'
  const { m, day } = parisParts(d)
  if (m === 12 || (m === 1 && day <= 6)) return 'winter'
  if ((m === 4 && day >= 15) || m === 5 || (m === 6 && day <= 20)) return 'playoffs'
  if ((m === 6 && day > 20) || (m === 7 && day <= 15)) return 'rookie'
  return 'classic'
}
// Doublons -> packs bonus
export const DUPES_PER_PACK = 15
export const SPORT_LABEL: Record<string, string> = { any: 'Mixte', nba: 'Basket (NBA)', wnba: 'WNBA', nfl: 'Football US (NFL)', hockey: 'Hockey', baseball: 'Baseball', 'soccer-international': 'Football', wrestling: 'Catch' }
// un thème n'est proposé que s'il y a assez de cartes pour que les packs ne se répètent pas
export const MIN_SPORT_POOL = 12
// thèmes toujours affichés (grisés tant que le pot n'a pas assez de cartes du sport)
export const TRADE_SPORTS = ['nba', 'nfl', 'hockey', 'baseball']
