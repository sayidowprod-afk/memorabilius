import { NextResponse } from 'next/server'
import { dayNumber, msToParisMidnight, parisDay } from '@/lib/jeuJoueur'

// Joueur mystère : le jour courant est décidé ici, par l'horloge du serveur (minuit, heure de Paris), jamais par l'appareil du joueur.
// Renvoie la date du jour, son numéro, l'heure du serveur et l'instant du prochain changement de joueur.
export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date()
  const day = parisDay(now)
  return NextResponse.json(
    { day, n: dayNumber(day), now: now.getTime(), nextAt: now.getTime() + msToParisMidnight(now) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
