import { NextResponse } from 'next/server'
import { dayNumber, msToParisMidnight, parisDay, type Dataset } from '@/lib/jeuJoueur'
import raw from '@/data/jeu-joueur.json'

// Joueur mystère : le jour courant est décidé ici, par l'horloge du serveur (minuit, heure de Paris), jamais par l'appareil du joueur.
// Renvoie la date du jour, son numéro, l'heure du serveur, l'instant du prochain changement de joueur,
// et une seule indication sur le joueur du jour : « actuel » ou « ancien » (donnée au joueur dès le début, sans rien dévoiler d'autre).
export const dynamic = 'force-dynamic'
const data = raw as unknown as Dataset
const byId = new Map(data.players.map(p => [p.id, p]))

export async function GET() {
  const now = new Date()
  const day = parisDay(now)
  const n = dayNumber(day)
  const answer = byId.get(data.order[(n - 1) % data.order.length])
  return NextResponse.json(
    { day, n, kind: answer?.legend ? 'ancien' : 'actuel', now: now.getTime(), nextAt: now.getTime() + msToParisMidnight(now) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
