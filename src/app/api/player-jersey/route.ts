import { NextRequest, NextResponse } from 'next/server'
import { fetchEspnPlayerBio } from '@/lib/espnHeadshot'

// Numero de maillot d'un joueur POUR UNE EQUIPE donnee (decoratif : filigrane du visualiseur).
// Source : ESPN (deja utilisee par la page joueur). Reponse mise en cache par le CDN : un joueur n'est interroge qu'une fois par jour.
export const revalidate = 86400

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' }

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get('name') || '').trim().slice(0, 80)
  const team = (req.nextUrl.searchParams.get('team') || '').trim().slice(0, 80)
  if (name.length < 3) return NextResponse.json({ jersey: null }, { status: 400 })
  try {
    const bio = await fetchEspnPlayerBio(name)
    if (!bio) return NextResponse.json({ jersey: null }, { headers: CACHE })
    let jersey: string | null = null
    if (team) {
      // numero porte DANS cette equipe (historique ESPN), le plus recent d'abord ; mot de fin : "76ers" pour "Philadelphia 76ers"
      const key = norm(team).split(' ').slice(-1)[0]
      const h = [...(bio.jerseyHistory || [])].reverse().find(x => norm(x.teamName).split(' ').slice(-1)[0] === key)
      jersey = h?.jersey ?? null
      // ESPN ne donne souvent que le numero ACTUEL : on ne l'utilise que si la carte est de l'equipe actuelle du joueur
      // (sinon ce serait peut-etre le numero d'une autre equipe : mieux vaut ne rien afficher que se tromper)
      if (!jersey) {
        const cur = (bio.career || []).slice(-1)[0]?.teamName
        if (cur && norm(cur).split(' ').slice(-1)[0] === key) jersey = bio.jersey
      }
    } else {
      jersey = bio.jersey
    }
    if (jersey && !/^\d{1,3}$/.test(jersey)) jersey = null
    return NextResponse.json({ jersey }, { headers: CACHE })
  } catch {
    return NextResponse.json({ jersey: null }, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
  }
}
