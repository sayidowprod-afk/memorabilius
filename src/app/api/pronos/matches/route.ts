import { NextRequest, NextResponse } from 'next/server'
import { fetchMatchesForOffsets } from '@/lib/pronosMatches'
import { weekOffsets } from '@/lib/pronosDays'

// Beaucoup d'appels externes en parallèle (7 jours x plusieurs sports) --
// le timeout par défaut de Vercel (10s) peut couper la réponse en plein
// milieu sur un cold start.
export const maxDuration = 60

// Semaine courante du lundi au dimanche (jours déjà passés inclus, avec leurs
// résultats), ou la semaine précédente avec ?week=prev.
export async function GET(req: NextRequest) {
  const prev = req.nextUrl.searchParams.get('week') === 'prev'
  const { days, matches } = await fetchMatchesForOffsets(weekOffsets(prev ? -1 : 0))
  return NextResponse.json({ days, matches })
}
