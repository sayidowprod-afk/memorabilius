import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SPORTS_TEAMS, teamLogoUrl, SportsTeam } from '@/lib/sportsTeams'
import { teamSlug, playerSlug } from '@/lib/playerSlug'

export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function findTeam(slug: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => teamSlug(t.name) === slug) || null
}

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

async function fetchTeamData(slug: string) {
  const team = findTeam(slug)
  if (!team) return { team: null, sets: [], communityCards: [], players: [] }

  // Sets where this team appears
  const { data: entries } = await supabase
    .from('card_set_entries')
    .select('set_id, player_name, is_rc, card_sets(id, name, year, brand, sport)')
    .ilike('team', `%${team.name.split(' ').slice(-1)[0]}%`) // match by last word (e.g. "76ers", "Lakers")

  // Deduplicate sets and collect players
  const setsMap = new Map<number, any>()
  const playersMap = new Map<string, { name: string; isRc: boolean }>()
  for (const e of entries || []) {
    const cs = (e as any).card_sets
    if (!cs) continue
    if (!setsMap.has(cs.id)) setsMap.set(cs.id, { ...cs })
    if (e.player_name) {
      if (!playersMap.has(e.player_name)) playersMap.set(e.player_name, { name: e.player_name, isRc: false })
      if (e.is_rc) playersMap.get(e.player_name)!.isRc = true
    }
  }
  const sets = [...setsMap.values()].sort((a, b) => (b.year || 0) - (a.year || 0))
  const players = [...playersMap.values()].slice(0, 30)

  // Community cards for this team
  const teamLastWord = team.name.split(' ').slice(-1)[0]
  const { data: communityCards } = await supabase
    .from('cartes_manuelles')
    .select('id, nom, annee, marque, image_recto, user_id, profiles(display_name, avatar_url)')
    .ilike('equipe', `%${teamLastWord}%`)
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })
    .limit(24)

  return { team, sets, communityCards: communityCards || [], players }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const team = findTeam(slug)
  if (!team) return { title: 'Équipe | Memorabilius' }
  const title = `${team.name} — Cartes de collection | Memorabilius`
  const desc = `Cartes de collection ${team.name} sur Memorabilius — joueurs, sets, collection communauté.`
  return { title, description: desc, openGraph: { title, description: desc } }
}

const ACCENT = '#003DA6'

export default async function EquipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { team, sets, communityCards, players } = await fetchTeamData(slug)

  if (!team) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 16px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 12 }}>Équipe introuvable</h1>
        <Link href="/recherche" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>← Recherche</Link>
      </div>
    )
  }

  const logoUrl = teamLogoUrl(team)
  const teamColor = team.color

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
        <img src={logoUrl} alt={team.name} style={{ width: 80, height: 80, objectFit: 'contain' }}
          onError={undefined} />
        <div>
          <div style={{ fontSize: 11, color: teamColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.08em' }}>
            {team.sport.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 10px', color: '#111' }}>{team.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: '#f0f4ff', color: ACCENT, padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
              {sets.length} sets
            </span>
            <span style={{ fontSize: 12, background: '#f0f0f0', color: '#555', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
              {communityCards.length} cartes en communauté
            </span>
          </div>
        </div>
      </div>

      {/* Joueurs */}
      {players.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: '#111' }}>Joueurs ({players.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {players.map((p: any) => (
              <Link key={p.name} href={`/joueur/${playerSlug(p.name)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: `2px solid ${teamColor}`, borderRadius: 50, padding: '5px 14px 5px 10px' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#121212' }}>{p.name}</span>
                  {p.isRc && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 700 }}>RC</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cartes communauté */}
      {communityCards.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: '#111' }}>Dans les collections ({communityCards.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {communityCards.map((card: any) => (
              <Link key={card.id} href={`/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', background: 'white', border: '1px solid #eee' }}>
                  <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                    <img src={card.image_recto} alt={card.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{(card.profiles as any)?.display_name}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sets */}
      {sets.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: '#111' }}>Sets ({sets.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {sets.map((set: any) => (
              <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 16px', border: '1px solid #eee' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#111', marginBottom: 3 }}>{set.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {set.year ? seasonLabel(set.year, set.sport) : ''}{set.brand ? ` · ${set.brand}` : ''} · {(set.sport || '').toUpperCase()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
