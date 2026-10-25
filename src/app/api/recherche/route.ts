import { NextRequest, NextResponse } from 'next/server'

import { getCachedHeadshots } from '@/lib/espnHeadshot'
import { fetchCsvCardsForProfilesCached } from '@/lib/csvCardsCache'
import { createServerClient } from '@/lib/supabaseServer'

const supabase = createServerClient()

// Rate limiter : 20 req/min par IP
const RATE_MAP = new Map<string, { count: number; reset: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of RATE_MAP) if (now > e.reset) RATE_MAP.delete(ip)
}, 60 * 60 * 1000)
function checkRate(ip: string): boolean {
  const now = Date.now()
  const e = RATE_MAP.get(ip)
  if (!e || now > e.reset) { RATE_MAP.set(ip, { count: 1, reset: now + 60_000 }); return true }
  if (e.count >= 20) return false
  e.count++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRate(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const query = req.nextUrl.searchParams.get('q')?.toLowerCase().trim()
  if (!query || query.length < 2) return NextResponse.json([])

  // Échappe les wildcards SQL pour éviter un match total (% → \%, _ → \_)
  const safeQ = query.replace(/%/g, '\\%').replace(/_/g, '\\_')
  // Normalise un texte pour comparaison insensible aux accents/ponctuation (matching
  // en JS, ex: cartes CSV ci-dessous -- pas de DB a interroger pour ces donnees).
  const normStr = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const normQuery = normStr(query)

  // Profils + manuelles en parallèle. Profils : liste complète (nécessaire pour
  // associer chaque carte à son collectionneur ensuite), pas de filtre texte ici
  // -- .limit(500) coupait silencieusement les profils au-dela (775 au total),
  // perdant leur attribution ET leurs cartes CSV dans les resultats (meme bug
  // que .limit(200) sur la page joueur). Pagination reelle.
  // Manuelles : recherche insensible aux accents via RPC (unaccent cote Postgres --
  // un simple .ilike() direct est sensible aux accents, "jokic" ne trouvait pas
  // "Jokić"), voir scripts/sql-search-unaccent.sql.
  const fetchAllProfiles = async () => {
    const all: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
        .range(from, from + 999)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < 1000) break
    }
    return all
  }
  const [profiles, { data: manuelles }] = await Promise.all([
    fetchAllProfiles(),
    supabase.rpc('search_cartes_manuelles_unaccent', { q: safeQ, max_rows: 500 }),
  ])
  if (!profiles) return NextResponse.json([])

  const results: any[] = []

  // Cartes privées scoped aux user_ids pertinents — évite le scan de 5000 lignes
  const manuellesUserIds = new Set((manuelles || []).map((m: any) => m.user_id))
  const csvUserIds = new Set(profiles.filter(p => p.lien_csv).map(p => p.id))
  const relevantUserIds = [...new Set([...manuellesUserIds, ...csvUserIds])]
  const { data: privees } = relevantUserIds.length > 0
    ? await supabase.from('cartes_privees').select('user_id, card_key').in('user_id', relevantUserIds)
    : { data: null }
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
  const isPrivate = (userId: string, cardKey: string) => privateSet.has(`${userId}::${cardKey}`)

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  ;(manuelles || []).forEach((m: any) => {
    const p = profileMap.get(m.user_id)
    if (!p || isPrivate(m.user_id, m.image_recto)) return
    results.push({
      img: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
      name: m.nom || '', team: m.equipe || '', year: m.annee || '',
      brand: m.marque || '', serie: m.collection || '', variant: m.variation || '',
      num: m.num || '', auto: m.auto || false, rc: m.rc || false, patch: m.patch || false,
      is_horizontal: m.is_horizontal || false,
      disponible_vente: m.disponible_vente || false,
      collector: p.display_name, collectorId: p.id,
      collectorAvatar: p.avatar_url, accent: p.couleur_bordure || '#003DA6',
    })
  })

  // Cartes CSV — cache persistant (table csv_cards_cache), survit aux cold
  // starts serverless contrairement a l'ancien cache memoire par process.
  const csvAll = await fetchCsvCardsForProfilesCached(profiles)
  csvAll.forEach(c => {
    const name = normStr(c.name)
    const team = normStr(c.team)
    const variant = normStr(c.variant)
    const brand = normStr(c.brand)
    if (!(name.includes(normQuery) || team.includes(normQuery) || variant.includes(normQuery) || brand.includes(normQuery))) return
    if (isPrivate(c.user_id, c.img)) return
    results.push({ ...c, collector: c.display_name, collectorId: c.user_id, collectorAvatar: c.avatar_url, accent: c.accent })
  })

  // Collectionneurs — filtre côté DB, insensible aux accents (voir RPC plus haut)
  const { data: matchingProfiles } = await supabase
    .rpc('search_profiles_unaccent', { q: safeQ, max_rows: 10 })
  const users = (matchingProfiles || []).map((p: any) => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, accent: p.couleur_bordure || '#003DA6' }))

  // ── Joueurs ────────────────────────────────────────────────────────────────
  // Source 1 : card_set_entries (joueurs avec sets dans la DB)
  // Source 2 : ESPN search (tous les joueurs, anciens inclus) — en parallèle
  const ESPN_SPORTS = ['basketball', 'football', 'hockey', 'baseball']
  // Ligue ESPN attendue par index — écarte les homonymes d'autres ligues que
  // l'API de recherche ESPN renvoie parfois (ex: chercher en "basketball" peut
  // aussi renvoyer un joueur de football universitaire du même nom)
  const ESPN_LEAGUES = ['nba', 'nfl', 'nhl', 'mlb']
  const [playerEntriesRes, ...espnSearchResults] = await Promise.all([
    supabase
      .from('card_set_entries')
      .select('player_name, is_rc, card_sets(sport)')
      .ilike('player_name', `%${safeQ}%`)
      .order('player_name')
      .limit(200),
    ...ESPN_SPORTS.map(sport =>
      fetch(
        `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=10&type=player&sport=${sport}`,
        { signal: AbortSignal.timeout(3000), next: { revalidate: 3600 } } as RequestInit
      ).then(r => r.ok ? r.json() : null).catch(() => null)
    ),
  ])

  type PEntry = { name: string; isRc: boolean; sports: Set<string>; photo: string | null }
  const playersMap = new Map<string, PEntry>()

  // Intègre les joueurs de la DB
  for (const e of playerEntriesRes.data || []) {
    const name = e.player_name
    if (!name) continue
    const sport = (e as any).card_sets?.sport || 'nba'
    if (!playersMap.has(name)) playersMap.set(name, { name, isRc: false, sports: new Set(), photo: null })
    const p = playersMap.get(name)!
    if (e.is_rc) p.isRc = true
    p.sports.add(sport)
  }

  // Intègre les joueurs ESPN (avec leur photo directement dans la réponse)
  const ESPN_SPORT_LABEL: Record<string, string> = {
    basketball: 'nba', football: 'nfl', hockey: 'nhl', baseball: 'mlb',
  }
  for (let i = 0; i < espnSearchResults.length; i++) {
    const data = espnSearchResults[i]
    if (!data) continue
    const sportLabel = ESPN_SPORT_LABEL[ESPN_SPORTS[i]] || 'nba'
    for (const section of data.results || []) {
      for (const a of section.contents || []) {
        if (!a.displayName) continue
        if (a.defaultLeagueSlug && a.defaultLeagueSlug !== ESPN_LEAGUES[i]) continue
        const normA = normStr(a.displayName)
        // Cherche si ce joueur est déjà dans la map (par nom normalisé)
        const existing = [...playersMap.entries()].find(([k]) => normStr(k) === normA)
        if (existing) {
          // Complète la photo si manquante
          if (!existing[1].photo && a.image?.default) existing[1].photo = a.image.default
        } else {
          // Nouveau joueur (retraité ou absent de la DB)
          playersMap.set(a.displayName, {
            name: a.displayName,
            isRc: false,
            sports: new Set([sportLabel]),
            photo: a.image?.default || null,
          })
        }
      }
    }
  }

  // Trie par pertinence : exact > commence par la requête > mot entier commence par > reste
  const rankMatch = (name: string) => {
    const n = name.toLowerCase()
    if (n === query) return 0
    if (n.startsWith(query)) return 1
    if (n.split(' ').some(w => w.startsWith(query))) return 2
    return 3
  }
  let players = [...playersMap.values()]
    .sort((a, b) => rankMatch(a.name) - rankMatch(b.name) || a.name.localeCompare(b.name))
    .slice(0, 20)
    .map(p => ({ name: p.name, isRc: p.isRc, sports: [...p.sports], photo: p.photo }))

  // Pour les joueurs encore sans photo, fallback complet par joueur (CDN NBA
  // pour les retraités NBA, puis Wikipedia pour les très vieux joueurs de
  // tout sport) — cache persistant (table player_photo_cache) au lieu d'un
  // appel ESPN en direct a CHAQUE recherche pour le meme joueur.
  const stillMissingPhoto = players.filter(p => !p.photo)
  if (stillMissingPhoto.length > 0) {
    const bySport = new Map<string, string[]>()
    for (const p of stillMissingPhoto) {
      const sport = p.sports[0] || 'nba'
      if (!bySport.has(sport)) bySport.set(sport, [])
      bySport.get(sport)!.push(p.name)
    }
    const photoByName = new Map<string, string | null>()
    await Promise.all([...bySport.entries()].map(async ([sport, names]) => {
      const resolved = await getCachedHeadshots(names, sport)
      for (const n of names) photoByName.set(n, resolved[n] ?? null)
    }))
    players = players.map(p => p.photo ? p : { ...p, photo: photoByName.get(p.name) || null })
  }

  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1
    const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1
    return aExact - bExact
  })

  return NextResponse.json({ cards: results, users, players }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
