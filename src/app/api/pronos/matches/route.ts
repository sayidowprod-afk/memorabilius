import { NextResponse } from 'next/server'
import { fetchMatchesForOffsets } from '@/lib/pronosMatches'

// Beaucoup d'appels externes en parallèle (7 jours x plusieurs sports) --
// le timeout par défaut de Vercel (10s) peut couper la réponse en plein
// milieu sur un cold start.
export const maxDuration = 60

export async function GET() {
  const { days, matches } = await fetchMatchesForOffsets([0, 1, 2, 3, 4, 5, 6])
  return NextResponse.json({ days, matches })
}
