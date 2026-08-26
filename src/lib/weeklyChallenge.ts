// Défi hebdomadaire — pas de table dédiée : le défi "en cours" est choisi de
// façon déterministe selon le numéro de semaine ISO dans une liste fixe de
// modèles (même défi pour tout le monde durant une semaine donnée, change
// chaque lundi, sans tâche planifiée), et la progression est calculée à la
// demande depuis cartes_manuelles — même principe que le RPC de podium.
import type { TranslationKey } from '@/lib/LangContext'

export interface CardFlags { rc: boolean; auto: boolean; patch: boolean; num: string | null }

export interface ChallengeTemplate {
  id: string
  emoji: string
  // Clés i18n (voir LangContext.tsx) plutôt que du texte en dur — ce fichier
  // n'a pas accès à useLang(), la traduction se fait au point d'affichage.
  labelKey: TranslationKey
  unitKey: TranslationKey
  target: number
  match: (c: CardFlags) => boolean
  rewardXp: number
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { id: 'add10', emoji: '🃏', labelKey: 'challenge_add10', unitKey: 'challenge_unit_cards', target: 10, match: () => true, rewardXp: 20 },
  { id: 'rc5', emoji: '⭐', labelKey: 'challenge_rc5', unitKey: 'challenge_unit_rc', target: 5, match: c => c.rc, rewardXp: 20 },
  { id: 'auto3', emoji: '✍️', labelKey: 'challenge_auto3', unitKey: 'challenge_unit_auto', target: 3, match: c => c.auto, rewardXp: 20 },
  { id: 'patch3', emoji: '🩹', labelKey: 'challenge_patch3', unitKey: 'challenge_unit_patch', target: 3, match: c => c.patch, rewardXp: 20 },
  { id: 'num5', emoji: '🔢', labelKey: 'challenge_num5', unitKey: 'challenge_unit_num', target: 5, match: c => !!c.num, rewardXp: 20 },
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

// Lundi 00:00 suivant — moment où le défi change (voir currentChallenge, qui
// change chaque lundi selon le numéro de semaine ISO). Utilisé pour le
// countdown affiché dans le widget et, côté serveur, comme borne pour ne
// verser la récompense qu'une fois par semaine.
export function endOfWeekISO(): string {
  const monday = new Date(startOfWeekISO())
  monday.setDate(monday.getDate() + 7)
  return monday.toISOString()
}

// Clé stable identifiant la semaine ISO en cours (ex: "2026-W35"), utilisée
// pour empêcher de re-verser la récompense plusieurs fois pour le même défi.
export function currentWeekKey(): string {
  const d = new Date()
  const week = isoWeekNumber(d)
  return `${d.getUTCFullYear()}-W${week}`
}
