import type { Metadata } from 'next'
import Link from 'next/link'
import { SPORTS_TEAMS, teamLogoUrl, SportsTeam } from '@/lib/sportsTeams'
import { teamSlug, playerSlug } from '@/lib/playerSlug'
import { fetchCsvCardsForProfilesCached } from '@/lib/csvCardsCache'
import TagIcon from '@/components/TagIcon'
import FranchiseChecklist, { type FranchisePlayer } from '@/components/FranchiseChecklist'
import { cleanFranchise } from '@/lib/franchiseExclude'
import TeamCardsSection from './TeamCardsSection'
import TeamSetsSection from './TeamSetsSection'
import { createServerClient } from '@/lib/supabaseServer'

export const revalidate = 86400 // 24h (etait 1h -- contenu quasi statique, cf. reduction couts Vercel ISR)

const supabase = createServerClient()

function findTeam(slug: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => teamSlug(t.name) === slug) || null
}

async function fetchTeamData(slug: string) {
  const team = findTeam(slug)
  if (!team) return { team: null, sets: [], communityCards: [], players: [] }

  const teamLastWord = team.name.split(' ').slice(-1)[0]

  // .limit(5000) ne suffit pas a lui seul : PostgREST plafonne chaque reponse
  // a 1000 lignes (max_rows) quel que soit le .limit() demande (meme bug que
  // la page joueur, voir bcc3a8f0) -- une franchise avec plus de 1000 cartes
  // communaute en perdait silencieusement le reste. Pagination reelle.
  const fetchAllManuellesForTeam = async () => {
    const all: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, is_horizontal, user_id, profiles(display_name, avatar_url, couleur_bordure)')
        .ilike('equipe', `%${teamLastWord}%`)
        .not('image_recto', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, from + 999)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < 1000) break
    }
    return all
  }

  // get_team_sets/get_team_players font le GROUP BY cote DB plutot que de
  // rapatrier TOUTES les lignes (jusqu'a ~130k pour un nom d'equipe courant,
  // 1.4s+ mesure) juste pour en deduire les sets/joueurs distincts cote JS.
  const [setsData, playersData, manuData, profilesRes] = await Promise.all([
    supabase.rpc('get_team_sets', { p_team_pattern: teamLastWord }),
    supabase.rpc('get_team_players', { p_team_pattern: teamLastWord }),
    fetchAllManuellesForTeam(),
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
      .not('lien_csv', 'is', null),
  ])

  const sets = [...(setsData.data || [])].sort((a, b) => (b.year || 0) - (a.year || 0))
  const players = (playersData.data || []).map((p: any) => ({ name: p.name, isRc: p.is_rc }))

  // Cartes manuelles
  const manuellesCards = manuData.map((m: any) => ({
    id: m.id,
    img: m.image_recto,
    nom: m.nom,
    annee: m.annee,
    marque: m.marque,
    is_horizontal: m.is_horizontal,
    user_id: m.user_id,
    display_name: m.profiles?.display_name,
    avatar_url: m.profiles?.avatar_url,
    accent: m.profiles?.couleur_bordure || '#003DA6',
  }))

  // Cartes CSV
  const csvAll = await fetchCsvCardsForProfilesCached(profilesRes.data || [])
  const lowerTeam = teamLastWord.toLowerCase()
  const csvCards = csvAll
    .filter(c => c.team.toLowerCase().includes(lowerTeam))
    .map(c => ({
      id: `csv-${c.user_id}-${c.img}`,
      img: c.img,
      nom: c.name,
      annee: c.year,
      marque: c.brand,
      is_horizontal: false,
      user_id: c.user_id,
      display_name: c.display_name,
      avatar_url: c.avatar_url,
      accent: c.accent,
    }))

  // Fusionner + dédupliquer par img
  const seen = new Set<string>()
  const communityCards = [...manuellesCards, ...csvCards].filter(c => {
    if (seen.has(c.img)) return false
    seen.add(c.img)
    return true
  })

  return { team, sets, communityCards, players }
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

// Liste complete des joueurs de la franchise (generee par scripts/build-franchise.js)
async function loadFranchise(slug: string): Promise<FranchisePlayer[]> {
  try { return cleanFranchise(slug, (await import(`@/data/franchise/${slug}.json`)).default as FranchisePlayer[]) } catch { return [] }
}

export default async function EquipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { team, sets, communityCards, players } = await fetchTeamData(slug)
  const franchise = team ? await loadFranchise(slug) : []

  if (!team) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 16px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text, #111)', marginBottom: 12 }}>Équipe introuvable</h1>
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
        <img src={logoUrl} alt={team.name} className="team-logo-zoom-in" style={{ width: 80, height: 80, objectFit: 'contain' }}
          onError={undefined} />
        <div>
          <div style={{ fontSize: 11, color: teamColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.08em' }}>
            {team.sport.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 10px', color: 'var(--text, #111)' }}>{team.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: '#f0f4ff', color: ACCENT, padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
              {sets.length} sets
            </span>
            <span style={{ fontSize: 12, background: 'var(--bg3, #f0f0f0)', color: 'var(--text2, #555)', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
              {communityCards.length} cartes en communauté
            </span>
          </div>
        </div>
      </div>

      {franchise.length > 0 && <FranchiseChecklist team={team.name} players={franchise} color={teamColor} sport={team.sport} />}

      {/* Joueurs */}
      {players.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: 'var(--text, #111)' }}>Joueurs ({players.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {players.map((p: any) => (
              <Link key={p.name} href={`/joueur/${playerSlug(p.name)}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-bg, #fff)', border: `2px solid ${teamColor}`, borderRadius: 50, padding: '5px 14px 5px 10px' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text, #121212)' }}>{p.name}</span>
                  {p.isRc && <TagIcon kind="rc" h={20} />}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cartes communauté + Sets -- pagines au defilement (voir TeamCardsSection/
          TeamSetsSection), une franchise historique pouvait depasser 10 Mo de
          HTML a tout rendre d'un coup cote serveur. */}
      <TeamCardsSection slug={slug} initialCards={communityCards.slice(0, 48) as any} totalCount={communityCards.length} />
      <TeamSetsSection slug={slug} initialSets={sets.slice(0, 40) as any} totalCount={sets.length} />
    </div>
  )
}
