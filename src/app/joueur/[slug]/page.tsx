import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { fetchEspnHeadshot, fetchEspnPlayerBio } from '@/lib/espnHeadshot'
import { normalizeName, cardPageUrl } from '@/lib/playerSlug'

export const revalidate = 3600

// Request coalescing: si plusieurs renders simultanés demandent le même slug
// (dev mode HMR), on fait un seul appel Supabase au lieu de N → évite les timeouts
const _inflight = new Map<string, Promise<any>>()
function fetchPlayerOnce(slug: string, fn: () => Promise<any>) {
  if (_inflight.has(slug)) return _inflight.get(slug)!
  const p = fn()
  _inflight.set(slug, p)
  p.finally(() => _inflight.delete(slug))
  return p
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function slugToName(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function seasonLabel(startYear: number, endYear: number, sport = 'nba') {
  if (['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)) {
    return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`
  }
  return startYear === endYear
    ? `${startYear}–${String(startYear + 1).slice(2)}`
    : `${startYear}–${String(endYear + 1).slice(2)}`
}

function seasonLabelSingle(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

function buildCareerTimeline(career: { year: number; teamName: string }[]) {
  const sorted = [...career].filter(e => e.year > 0).sort((a, b) => a.year - b.year)
  const runs: { teamName: string; startYear: number; endYear: number }[] = []
  for (const { year, teamName } of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.teamName === teamName && year <= last.endYear + 1) {
      last.endYear = year
    } else {
      runs.push({ teamName, startYear: year, endYear: year })
    }
  }
  return runs
}

const SPORT_LABELS: Record<string, string> = {
  nba: '🏀 NBA', nfl: '🏈 NFL', baseball: '⚾ Baseball',
  hockey: '🏒 Hockey', pokemon: '🎴 Pokémon', mtg: '🧙 MTG',
}

function fetchPlayer(slug: string) {
  return fetchPlayerOnce(slug, () => _fetchPlayer(slug))
}

async function _fetchPlayer(slug: string) {
  const playerName = slugToName(slug)
  const normTarget = normalizeName(playerName)
  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  const [entriesRes, manuRes, profilesRes] = await Promise.all([
    // Sans join card_sets pour éviter le timeout sur la table volumineuse
    supabase
      .from('card_set_entries')
      .select('set_id, variation, is_rc, player_name')
      .ilike('player_name', `${firstName}%`)
      .ilike('player_name', `%${lastName}%`)
      .limit(3000),
    supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, rc, marque, collection, variation, image_recto, is_horizontal, user_id, profiles(display_name, avatar_url, couleur_bordure)')
      .ilike('nom', `%${firstName}%`)
      .ilike('nom', `%${lastName}%`)
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
      .not('lien_csv', 'is', null),
  ])

  const matchedEntries = (entriesRes.data || []).filter((e: any) => normalizeName(e.player_name || '').includes(normTarget))

  // Récupérer les métadonnées des sets en une seule requête IN (rapide)
  const uniqueSetIds = [...new Set(matchedEntries.map((e: any) => e.set_id as number))]
  const setsDataRes = uniqueSetIds.length > 0
    ? await supabase.from('card_sets').select('id, name, year, brand, sport').in('id', uniqueSetIds)
    : { data: [] }
  const setsById = new Map((setsDataRes.data || []).map((s: any) => [s.id, s]))
  const matchedManu = (manuRes.data || []).filter((m: any) => normalizeName(m.nom || '').includes(normTarget))

  // Sets — on utilise setsById (fetched séparément pour éviter le join lent)
  const setsMap = new Map<number, any>()
  for (const e of matchedEntries) {
    const cs = setsById.get(e.set_id)
    if (!cs) continue
    if (!setsMap.has(cs.id)) setsMap.set(cs.id, { ...cs, isRc: false, variations: [] })
    const s = setsMap.get(cs.id)!
    if (e.is_rc) s.isRc = true
    if (e.variation && !s.variations.includes(e.variation)) s.variations.push(e.variation)
  }
  const sets = [...setsMap.values()].sort((a, b) => (b.year || 0) - (a.year || 0))
  const primarySport = sets[0]?.sport || 'nba'

  const rcFromSets = sets.find((s: any) => s.isRc)?.year as number | undefined
  const rcFromManuelles = matchedManu.find((m: any) => m.rc)?.annee as string | undefined
  const rcYear = rcFromSets || (rcFromManuelles ? parseInt(rcFromManuelles) : undefined)

  const [csvAll, headshot, bio] = await Promise.all([
    fetchCsvCardsForProfiles(profilesRes.data || []),
    fetchEspnHeadshot(playerName, primarySport),
    fetchEspnPlayerBio(playerName, primarySport),
  ])

  const manuellesCards = matchedManu.map((m: any) => ({
    id: m.id,
    img: m.image_recto,
    nom: m.nom,
    annee: m.annee,
    marque: m.marque,
    collection: m.collection,
    variation: m.variation || '',
    rc: m.rc || false,
    is_horizontal: m.is_horizontal,
    user_id: m.user_id,
    display_name: m.profiles?.display_name,
    avatar_url: m.profiles?.avatar_url,
    accent: m.profiles?.couleur_bordure || '#003DA6',
    source: 'manuel' as const,
    cardUrl: cardPageUrl(m.user_id, { nom: m.nom, annee: m.annee, marque: m.marque, collection: m.collection, image_recto: m.image_recto }),
  }))

  const csvCards = csvAll
    .filter(c => normalizeName(c.name).includes(normTarget))
    .map(c => ({
      id: `csv-${c.user_id}-${c.img}`,
      img: c.img,
      nom: c.name,
      annee: c.year,
      marque: c.brand,
      collection: '',
      variation: '',
      rc: false,
      is_horizontal: false,
      user_id: c.user_id,
      display_name: c.display_name,
      avatar_url: c.avatar_url,
      accent: c.accent,
      source: 'csv' as const,
      cardUrl: `/galerie/${c.user_id}`,
    }))

  const seen = new Set<string>()
  const communityCards = [...manuellesCards, ...csvCards].filter(c => {
    if (seen.has(c.img)) return false
    seen.add(c.img)
    return true
  })

  const uniqueCollectors = new Set(communityCards.map(c => c.user_id)).size

  const varCounts = new Map<string, number>()
  for (const c of communityCards) {
    if (c.variation && c.variation !== 'Base') {
      varCounts.set(c.variation, (varCounts.get(c.variation) || 0) + 1)
    }
  }
  const topVariations = [...varCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const setsByYear = new Map<number, typeof sets>()
  for (const s of sets) {
    const y = s.year || 0
    if (!setsByYear.has(y)) setsByYear.set(y, [])
    setsByYear.get(y)!.push(s)
  }
  const sortedYears = [...setsByYear.keys()].sort((a, b) => b - a)

  return { playerName, sets, setsByYear, sortedYears, communityCards, rcYear, headshot, bio, uniqueCollectors, topVariations, primarySport }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const playerName = slugToName(slug)
  const title = `${playerName} — Cartes de collection | Memorabilius`
  const desc = `Retrouvez toutes les cartes ${playerName} sur Memorabilius : sets Panini, Topps, Prizm, Hoops, Select et bien plus.`
  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { card: 'summary_large_image', title, description: desc },
  }
}

export default async function JoueurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { playerName, sets, setsByYear, sortedYears, communityCards, rcYear, headshot, bio, uniqueCollectors, topVariations, primarySport } = await fetchPlayer(slug)

  const sports = [...new Set(sets.map((s: any) => s.sport as string))]
  const careerTimeline = bio?.career ? buildCareerTimeline(bio.career) : []
  const teamLogoUrl = bio?.currentTeamLogo
    ? `/api/team-logo?url=${encodeURIComponent(bio.currentTeamLogo)}`
    : null

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: playerName,
    url: `https://www.memorabilius.fr/joueur/${slug}`,
    description: `${sets.length} sets de cartes · ${communityCards.length} cartes en communauté`,
    ...(headshot ? { image: headshot } : {}),
    ...(bio?.birthDate ? { birthDate: bio.birthDate } : {}),
    ...(bio?.birthPlace ? { birthPlace: bio.birthPlace } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Setlist', item: 'https://www.memorabilius.fr/setlist' },
      { '@type': 'ListItem', position: 2, name: playerName, item: `https://www.memorabilius.fr/joueur/${slug}` },
    ],
  }

  if (sets.length === 0 && communityCards.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 16px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>{playerName}</h1>
        <p style={{ color: '#999', fontSize: 15, marginBottom: 24 }}>Aucune carte trouvée pour ce joueur dans notre base.</p>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, textDecoration: 'none' }}>← Voir le Setlist</Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        :root {
          --jp-bg: #f4f6fb;
          --jp-surface: #ffffff;
          --jp-surface2: #f8f9fc;
          --jp-text: #111111;
          --jp-text2: #555555;
          --jp-muted: #888888;
          --jp-border: #e8eaf0;
          --jp-accent: #003DA6;
          --jp-hero-from: #001a4d;
          --jp-hero-to: #0048c8;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --jp-bg: #0d0f14;
            --jp-surface: #161a24;
            --jp-surface2: #1e2232;
            --jp-text: #f0f2f8;
            --jp-text2: #b0b8cc;
            --jp-muted: #666e88;
            --jp-border: #252a3a;
            --jp-accent: #4d82ff;
            --jp-hero-from: #000a1f;
            --jp-hero-to: #001a5c;
          }
        }
        :root[data-theme="dark"] {
          --jp-bg: #0d0f14;
          --jp-surface: #161a24;
          --jp-surface2: #1e2232;
          --jp-text: #f0f2f8;
          --jp-text2: #b0b8cc;
          --jp-muted: #666e88;
          --jp-border: #252a3a;
          --jp-accent: #4d82ff;
          --jp-hero-from: #000a1f;
          --jp-hero-to: #001a5c;
        }
        :root[data-theme="light"] {
          --jp-bg: #f4f6fb;
          --jp-surface: #ffffff;
          --jp-surface2: #f8f9fc;
          --jp-text: #111111;
          --jp-text2: #555555;
          --jp-muted: #888888;
          --jp-border: #e8eaf0;
          --jp-accent: #003DA6;
          --jp-hero-from: #001a4d;
          --jp-hero-to: #0048c8;
        }
        .jp-card-hover { transition: transform 0.15s, box-shadow 0.15s; }
        .jp-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.14); }
        .jp-set-hover:hover { border-color: var(--jp-accent) !important; background: var(--jp-surface2) !important; }
        .jp-career-row:hover { background: rgba(0,61,166,0.05) !important; }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Full-bleed container — breaks out of layout.tsx's maxWidth/padding */}
      <div style={{
        background: 'var(--jp-bg)',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
        marginLeft: 'calc(50% - 50vw)',
        width: '100vw',
        marginTop: '-20px',
      }}>

        {/* ── HERO ── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--jp-hero-from) 0%, var(--jp-hero-to) 100%)',
          color: 'white',
          padding: '44px 24px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Team logo watermark */}
          {teamLogoUrl && (
            <img
              src={teamLogoUrl}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '340px',
                height: '340px',
                objectFit: 'contain',
                opacity: 0.18,
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, white 45%)',
                maskImage: 'linear-gradient(to right, transparent 0%, white 45%)',
                pointerEvents: 'none',
              }}
            />
          )}

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            {/* Breadcrumb */}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 22, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Link href="/setlist" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 600, transition: 'color 0.1s' }}>Setlist</Link>
              <span>/</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{playerName}</span>
            </div>

            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Headshot */}
              {headshot && (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={headshot}
                    alt={playerName}
                    style={{
                      width: 150,
                      height: 150,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      border: '3px solid rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 220 }}>
                {/* Sport pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {sports.map(s => (
                    <span key={s} style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '3px 9px', letterSpacing: '0.06em' }}>
                      {SPORT_LABELS[s] || s.toUpperCase()}
                    </span>
                  ))}
                </div>

                <h1 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.05, letterSpacing: '-0.025em', textWrap: 'balance' as any }}>{playerName}</h1>

                {/* Bio: position · jersey · height · weight */}
                {bio && (bio.position || bio.jersey || bio.height || bio.weight) && (
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {bio.jersey && <span style={{ fontWeight: 800, fontSize: 16 }}>#{bio.jersey}</span>}
                    {bio.position && <span>{bio.position}</span>}
                    {(bio.position && (bio.height || bio.weight)) && <span style={{ opacity: 0.35 }}>·</span>}
                    {bio.height && <span>{bio.height}</span>}
                    {bio.weight && <span style={{ color: 'rgba(255,255,255,0.55)' }}>{bio.weight}</span>}
                    {bio.nationality && <><span style={{ opacity: 0.35 }}>·</span><span>{bio.nationality}</span></>}
                  </div>
                )}

                {/* Birth + current team */}
                {bio && (bio.birthDate || bio.birthPlace) && (
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
                    🎂 {bio.birthDate && new Date(bio.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {bio.birthPlace ? ` · ${bio.birthPlace}` : ''}
                    {bio.age ? ` (${bio.age} ans)` : ''}
                  </div>
                )}

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rcYear && (
                    <span style={{ fontSize: 12, background: '#e67e22', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 800 }}>
                      RC {rcYear}
                    </span>
                  )}
                  {sets.length > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      {sets.length} set{sets.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {communityCards.length > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      {communityCards.length} carte{communityCards.length > 1 ? 's' : ''} communauté
                    </span>
                  )}
                  {uniqueCollectors > 0 && (
                    <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                      👥 {uniqueCollectors} collectionneur{uniqueCollectors > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENU ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 48px' }}>

          {/* Top variations dans la communauté */}
          {topVariations.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--jp-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
                Parallèles les plus collectés
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topVariations.map(([v, count]) => (
                  <span key={v} style={{ fontSize: 12, fontWeight: 700, background: 'var(--jp-surface)', border: '1.5px solid var(--jp-border)', color: 'var(--jp-text2)', borderRadius: 20, padding: '5px 14px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {v}
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--jp-accent)', background: 'rgba(0,61,166,0.08)', borderRadius: 10, padding: '1px 6px' }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cartes de la communauté */}
          {communityCards.length > 0 && (
            <section style={{ marginBottom: 52 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
                  Dans les collections
                </h2>
                <span style={{ fontSize: 13, color: 'var(--jp-muted)', fontWeight: 600 }}>
                  {communityCards.length} carte{communityCards.length > 1 ? 's' : ''} · {uniqueCollectors} collectionneur{uniqueCollectors > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
                {communityCards.map((card: any) => (
                  <Link key={card.id} href={card.source === 'manuel' ? card.cardUrl : `/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                    <div className="jp-card-hover" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--jp-surface)', border: '1.5px solid var(--jp-border)', height: '100%' }}>
                      <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', background: '#111' }}>
                        <img
                          src={card.img}
                          alt={card.nom}
                          style={card.is_horizontal ? {
                            position: 'absolute', width: '140%', height: '71.43%',
                            left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                          } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {card.rc && (
                          <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontWeight: 900, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: 3, lineHeight: 1.4 }}>RC</span>
                        )}
                      </div>
                      <div style={{ padding: '8px 10px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--jp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                        <div style={{ fontSize: 10, color: 'var(--jp-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[card.annee, card.marque].filter(Boolean).join(' · ')}
                        </div>
                        {card.variation && (
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--jp-accent)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(0,61,166,0.07)', borderRadius: 3, padding: '1px 5px', display: 'inline-block', maxWidth: '100%' }}>
                            {card.variation}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--jp-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <img
                            src={card.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.display_name || 'U')}&background=003DA6&color=fff&size=20`}
                            style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0 }}
                            alt=""
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.display_name}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── CARRIÈRE (jersey history) ── */}
          {careerTimeline.length > 0 && (
            <section style={{ marginBottom: 52 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: '0 0 16px' }}>
                Historique de carrière
              </h2>
              <div style={{ background: 'var(--jp-surface)', borderRadius: 12, border: '1.5px solid var(--jp-border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--jp-border)', background: 'var(--jp-surface2)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 800, color: 'var(--jp-muted)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saison</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 800, color: 'var(--jp-muted)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Équipe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerTimeline.map((run, i) => (
                      <tr
                        key={`${run.teamName}-${run.startYear}`}
                        className="jp-career-row"
                        style={{
                          borderBottom: i < careerTimeline.length - 1 ? '1px solid var(--jp-border)' : undefined,
                          transition: 'background 0.1s',
                        }}
                      >
                        <td style={{ padding: '11px 16px', color: 'var(--jp-muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {seasonLabel(run.startYear, run.endYear, primarySport)}
                        </td>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--jp-text)' }}>
                          {run.teamName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Sets groupés par année */}
          {sets.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
                  Sets ({sets.length})
                </h2>
                <Link href={`/setlist?q=${encodeURIComponent(playerName)}`} style={{ fontSize: 13, color: 'var(--jp-accent)', fontWeight: 700, textDecoration: 'none' }}>
                  Voir dans le Setlist →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {sortedYears.map(year => {
                  const yearSets = setsByYear.get(year) || []
                  const sport = yearSets[0]?.sport || primarySport
                  return (
                    <div key={year}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--jp-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>{year > 0 ? seasonLabelSingle(year, sport) : 'Année inconnue'}</span>
                        <span style={{ color: 'var(--jp-border)', fontSize: 10 }}>— {yearSets.length} set{yearSets.length > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                        {yearSets.map((set: any) => (
                          <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
                            <div className="jp-set-hover" style={{ background: 'var(--jp-surface)', borderRadius: 10, padding: '12px 16px', border: '1.5px solid var(--jp-border)', transition: '0.15s', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--jp-text)', lineHeight: 1.3, flex: 1 }}>{set.name}</div>
                                {set.isRc && (
                                  <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 7px', borderRadius: 3, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>RC</span>
                                )}
                              </div>
                              {set.brand && (
                                <div style={{ fontSize: 10, color: 'var(--jp-accent)', fontWeight: 700, marginTop: 4 }}>{set.brand}</div>
                              )}
                              {set.variations.filter((v: string) => v !== 'Base').length > 0 && (
                                <div style={{ marginTop: 7, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {set.variations.filter((v: string) => v !== 'Base').slice(0, 4).map((v: string) => (
                                    <span key={v} style={{ fontSize: 9, background: 'rgba(0,61,166,0.07)', color: 'var(--jp-accent)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>{v}</span>
                                  ))}
                                  {set.variations.filter((v: string) => v !== 'Base').length > 4 && (
                                    <span style={{ fontSize: 9, color: 'var(--jp-muted)', padding: '2px 4px' }}>+{set.variations.filter((v: string) => v !== 'Base').length - 4}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}
