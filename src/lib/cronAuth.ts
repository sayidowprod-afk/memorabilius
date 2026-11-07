import { timingSafeEqual } from 'node:crypto'

// Vérifie l'en-tête « Authorization: Bearer <CRON_SECRET> » d'une tâche planifiée, en temps constant.
// Sans CRON_SECRET configuré, tout est refusé.
export function cronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const a = Buffer.from(authHeader), b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}
