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

// Tout calculé en UTC (jamais avec les getters locaux type getDay()/getHours())
// — sinon la limite de semaine dépend du fuseau horaire de la machine qui
// exécute le code, qui diffère entre le navigateur d'un utilisateur et le
// serveur (Vercel = UTC) : un même moment pouvait être compté dans "cette
// semaine" côté client (qui affiche le défi complété) mais dans la semaine
// précédente côté serveur (qui refuse alors de verser la récompense).
//
// isoWeekYearAndNumber retourne aussi l'année ISO (celle du jeudi de la
// semaine), pas l'année civile brute du jour donné — nécessaire autour du
// nouvel an, où un lundi 30 décembre peut appartenir à la semaine 1 de
// l'année suivante. currentWeekKey() doit utiliser cette même année pour
// rester cohérente avec le numéro de semaine qu'elle accompagne.
function isoWeekYearAndNumber(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const year = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year, week }
}

export function currentChallenge(): ChallengeTemplate {
  const { week } = isoWeekYearAndNumber(new Date())
  return CHALLENGE_TEMPLATES[week % CHALLENGE_TEMPLATES.length]
}

export function startOfWeekISO(): string {
  const now = new Date()
  const day = now.getUTCDay() || 7
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - day + 1)
  return monday.toISOString()
}

// Lundi 00:00 UTC suivant — moment où le défi change (voir currentChallenge,
// qui change chaque lundi selon le numéro de semaine ISO). Utilisé pour le
// countdown affiché dans le widget et, côté serveur, comme borne pour ne
// verser la récompense qu'une fois par semaine.
export function endOfWeekISO(): string {
  const monday = new Date(startOfWeekISO())
  monday.setUTCDate(monday.getUTCDate() + 7)
  return monday.toISOString()
}

// Clé stable identifiant la semaine ISO en cours (ex: "2026-W35"), utilisée
// pour empêcher de re-verser la récompense plusieurs fois pour le même défi.
export function currentWeekKey(): string {
  const { year, week } = isoWeekYearAndNumber(new Date())
  return `${year}-W${week}`
}
