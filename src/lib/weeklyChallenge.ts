// Défi hebdomadaire — pas de table dédiée : le défi "en cours" est choisi de
// façon déterministe selon le numéro de semaine ISO dans une liste fixe de
// modèles (même défi pour tout le monde durant une semaine donnée, change
// chaque lundi, sans tâche planifiée), et la progression est calculée à la
// demande depuis cartes_manuelles — même principe que le RPC de podium.
export interface CardFlags { rc: boolean; auto: boolean; patch: boolean; num: string | null }

export interface ChallengeTemplate {
  id: string
  emoji: string
  label: string
  unit: string
  target: number
  match: (c: CardFlags) => boolean
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { id: 'add10', emoji: '🃏', label: 'Ajoute des cartes', unit: 'cartes', target: 10, match: () => true },
  { id: 'rc5', emoji: '⭐', label: 'Ajoute des Rookie Cards', unit: 'RC', target: 5, match: c => c.rc },
  { id: 'auto3', emoji: '✍️', label: 'Ajoute des autographes', unit: 'autos', target: 3, match: c => c.auto },
  { id: 'patch3', emoji: '🩹', label: 'Ajoute des patches', unit: 'patches', target: 3, match: c => c.patch },
  { id: 'num5', emoji: '🔢', label: 'Ajoute des cartes numérotées', unit: 'numérotées', target: 5, match: c => !!c.num },
]

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function currentChallenge(): ChallengeTemplate {
  const week = isoWeekNumber(new Date())
  return CHALLENGE_TEMPLATES[week % CHALLENGE_TEMPLATES.length]
}

export function startOfWeekISO(): string {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - day + 1)
  return monday.toISOString()
}
