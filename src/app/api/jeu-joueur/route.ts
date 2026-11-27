import { NextResponse } from 'next/server'
import { bobbleFor } from '@/lib/bobbleheadsServer'
import type { Dataset } from '@/lib/jeuJoueur'
import raw from '@/data/jeu-joueur.json'

// Joueur mystère : liste des joueurs proposables (nom, équipe, poste, photo), SANS le joueur du jour ni ses caractéristiques de comparaison.
// La comparaison et le joueur du jour se font côté serveur : POST /api/jeu-joueur/play.
const data = raw as unknown as Dataset

export async function GET() {
  const players = data.players.map(p => {
    const f = bobbleFor(p.name)
    return { id: p.id, name: p.name, team: p.team, teamName: p.teamName, pos: p.pos, img: p.img, head: f && !f.sport && f.headSrc ? f.headSrc : null, legend: p.legend }
  })
  return NextResponse.json({ players }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=3600' } })
}
