import { NextRequest, NextResponse } from 'next/server'
import { cachedAsync } from '@/lib/ttlCache'
import { fetchAllPaged } from '@/lib/playerManuelles'
import { rpcPaged } from '@/lib/fastCards'
import { SPORTS_TEAMS, type SportsTeam } from '@/lib/sportsTeams'
import { teamSlug } from '@/lib/playerSlug'
import { fetchCsvCardsForProfilesCached } from '@/lib/csvCardsCache'
import { createServerClient } from '@/lib/supabaseServer'
import { demoUserIds } from '@/lib/demoUsers'

// Pagination de la section "Dans les collections" d'une page equipe
// (defilement), meme principe que /api/player-cards.
const supabase = createServerClient()

function findTeam(slug: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => teamSlug(t.name) === slug) || null
}

const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 30) return false
  e.n++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const sp = req.nextUrl.searchParams
  const slug = sp.get('slug')?.trim()
  const team = slug ? findTeam(slug) : null
  if (!team) return NextResponse.json({ cards: [], total: 0, hasMore: false })
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  const limit = Math.min(96, Math.max(1, parseInt(sp.get('limit') || '48', 10) || 48))

  const teamLastWord = team.name.split(' ').slice(-1)[0]

  // Liste complète des cartes de l'équipe : cherchée en base UNE fois (5 min), puis découpée en pages en mémoire
  const cards = await cachedAsync(`tc:${slug}`, (v: any[]) => v.length ? 300_000 : 15_000, async () => {
    // pages de 1 000 demandées en parallèle (lib/playerManuelles)
    const manuelles = ((await rpcPaged(supabase, 'team_cards_search', { p_team: teamLastWord })) ?? await fetchAllPaged(from => supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto, is_horizontal, user_id, created_at, profiles(display_name, avatar_url, couleur_bordure)')
      .ilike('equipe', `%${teamLastWord}%`)
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + 999))).sort((x: any, y: any) => (y.created_at || '').localeCompare(x.created_at || ''))

    const demo = await demoUserIds(supabase) // compte démo (salons) : invisible
    const manuellesCards = manuelles.filter((m: any) => !demo.has(m.user_id)).map((m: any) => ({
      id: m.id, img: m.image_recto, nom: m.nom, annee: m.annee, marque: m.marque,
      is_horizontal: m.is_horizontal, user_id: m.user_id,
      display_name: m.profiles?.display_name, avatar_url: m.profiles?.avatar_url,
      accent: m.profiles?.couleur_bordure || '#003DA6',
    }))

    const { data: profilesData } = await supabase.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').not('lien_csv', 'is', null)
    const csvAll = await fetchCsvCardsForProfilesCached((profilesData || []).filter((p: any) => !demo.has(p.id)))
    const lowerTeam = teamLastWord.toLowerCase()
    const csvCards = csvAll
      .filter(c => c.team.toLowerCase().includes(lowerTeam))
      .map(c => ({
        id: `csv-${c.user_id}-${c.img}`, img: c.img, nom: c.name, annee: c.year, marque: c.brand,
        is_horizontal: false, user_id: c.user_id, display_name: c.display_name, avatar_url: c.avatar_url, accent: c.accent,
      }))

    const seen = new Set<string>()
    return [...manuellesCards, ...csvCards].filter(c => {
      if (seen.has(c.img)) return false
      seen.add(c.img)
      return true
    })
  })

  const total = cards.length
  const page = cards.slice(offset, offset + limit)
  return NextResponse.json({ cards: page, total, hasMore: offset + limit < total }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
