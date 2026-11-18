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
  rc: boolean; auto: boolean; patch?: boolean; run?: number | null; img: string; set: string | null; year: number | null; brand: string | null; sport: string | null; credit?: string | null
}
