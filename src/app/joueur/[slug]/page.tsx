import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { fetchEspnHeadshot, fetchEspnPlayerBio } from '@/lib/espnHeadshot'
import { normalizeName, cardPageUrl } from '@/lib/playerSlug'

export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function slugToName(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

const SPORT_LABELS: Record<string, string> = {
  nba: '🏀 NBA', nfl: '🏈 NFL', baseball: '⚾ Baseball',
  hockey: '🏒 Hockey', pokemon: '🎴 Pokémon', mtg: '🧙 MTG',
}

async function fetchPlayer(slug: string) {
  const playerName = slugToName(slug)
  const normTarget = normalizeName(playerName)
  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  const [entriesRes, manuRes, profilesRes] = await Promise.all([
    supabase
      .from('card_set_entries')
      .select('set_id, variation, is_rc, player_name, card_sets(id, name, year, brand, sport)')
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

  const matchedEntries = (entriesRes.data || []).filter((e: any) => normalizeName(e.player_name || '') === normTarget)
  const matchedManu = (manuRes.data || []).filter((m: any) => normalizeName(m.nom || '').includes(normTarget))

  // Sets
  const setsMap = new Map<number, any>()
  for (const e of matchedEntries) {
    const cs = (e as any).card_sets
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

  // Top variations dans la communauté
  const varCounts = new Map<string, number>()
  for (const c of communityCards) {
    if (c.variation && c.variation !== 'Base') {
      varCounts.set(c.variation, (varCounts.get(c.variation) || 0) + 1)
    }
  }
  const topVariations = [...varCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Sets groupés par année
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
  const { playerName, sets, communityCards } = await fetchPlayer(slug)

  const title = `${playerName} — Cartes de collection | Memorabilius`
  const desc = `Retrouvez toutes les cartes ${playerName} sur Memorabilius : ${sets.length} sets, ${communityCards.length} cartes en communauté. Prizm, Hoops, Select et bien plus.`

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
  const displayedCards = communityCards.slice(0, 30)

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
        .jp-card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.14); }
        .jp-set-hover:hover { border-color: var(--jp-accent) !important; background: var(--jp-surface2) !important; }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div style={{ background: 'var(--jp-bg)', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

        {/* ── HERO ── */}
        <div style={{ background: 'linear-gradient(135deg, var(--jp-hero-from) 0%, var(--jp-hero-to) 100%)', color: 'white', padding: '36px 16px 40px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Breadcrumb */}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Link href="/setlist" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}>Setlist</Link>
              <span>/</span>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{playerName}</span>
            </div>

            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Headshot */}
              {headshot && (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={headshot}
                    alt={playerName}
                    style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '3px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)' }}
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

                <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{playerName}</h1>

                {/* Bio row: position · jersey · height · weight */}
                {bio && (bio.position || bio.jersey || bio.height || bio.weight) && (
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {bio.jersey && <span style={{ fontWeight: 800, fontSize: 15 }}>#{bio.jersey}</span>}
                    {bio.position && <span>{bio.position}</span>}
                    {(bio.position && (bio.height || bio.weight)) && <span style={{ opacity: 0.4 }}>·</span>}
                    {bio.height && <span>{bio.height}</span>}
                    {bio.weight && <span style={{ color: 'rgba(255,255,255,0.55)' }}>{bio.weight}</span>}
                    {bio.nationality && <span style={{ opacity: 0.4 }}>·</span>}
                    {bio.nationality && <span>{bio.nationality}</span>}
                  </div>
                )}

                {/* Birth + teams */}
                {bio && (bio.birthDate || bio.birthPlace || bio.teams.length > 0) && (
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 16 }}>
                    {(bio.birthDate || bio.birthPlace) && (
                      <span>
                        🎂 {bio.birthDate && new Date(bio.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {bio.birthPlace ? ` · ${bio.birthPlace}` : ''}
                        {bio.age ? ` (${bio.age} ans)` : ''}
                      </span>
                    )}
                    {bio.teams.length > 0 && (
                      <span>🏟️ {bio.teams.join(' · ')}</span>
                    )}
                  </div>
                )}

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rcYear && (
                    <span style={{ fontSize: 12, background: '#e67e22', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 800 }}>
                      RC {rcYear}
                    </span>
                  )}
                  <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                    {sets.length} set{sets.length > 1 ? 's' : ''}
                  </span>
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
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }}>

          {/* Top variations dans la communauté */}
          {topVariations.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--jp-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
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
            <section style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
                  Dans les collections
                </h2>
                <span style={{ fontSize: 13, color: 'var(--jp-muted)', fontWeight: 600 }}>
                  {communityCards.length} carte{communityCards.length > 1 ? 's' : ''} · {uniqueCollectors} collectionneur{uniqueCollectors > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
                {displayedCards.map((card: any) => (
                  <Link key={card.id} href={card.source === 'manuel' ? card.cardUrl : `/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                    <div className="jp-card-hover" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--jp-surface)', border: '1.5px solid var(--jp-border)', transition: 'transform 0.15s, box-shadow 0.15s', height: '100%' }}>
                      <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', background: '#111' }}>
                        <img
                          src={card.img}
                          alt={card.nom}
                          style={card.is_horizontal ? {
                            position: 'absolute', width: '140%', height: '71.43%',
                            left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                          } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {/* Badges superposés */}
                        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {card.rc && (
                            <span style={{ fontSize: 9, fontWeight: 900, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: 3, lineHeight: 1.4 }}>RC</span>
                          )}
                        </div>
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
              {communityCards.length > 30 && (
                <p style={{ fontSize: 13, color: 'var(--jp-muted)', marginTop: 14, textAlign: 'center', fontWeight: 600 }}>
                  + {communityCards.length - 30} carte{communityCards.length - 30 > 1 ? 's' : ''} supplémentaire{communityCards.length - 30 > 1 ? 's' : ''} dans la communauté
                </p>
              )}
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
                        <span>{year > 0 ? seasonLabel(year, sport) : 'Année inconnue'}</span>
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
