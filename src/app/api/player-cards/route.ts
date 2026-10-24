import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { normalizeName, cardPageUrl } from '@/lib/playerSlug'

// Pagination des "cartes communaute" d'un joueur, appelee par
// CommunityCardsSection.tsx (defilement + changement de filtre/tri).
//
// Duplique volontairement une partie du fetch deja present dans
// joueur/[slug]/page.tsx (matching nom, pagination .range() par 1000, fusion
// CSV) plutot que de le factoriser -- page.tsx a aussi besoin de la liste
// COMPLETE pour la checklist/RC/sets derives, donc son fetch initial reste
// inchange (deja teste, fonctionne) ; cette route ne sert que les pages
// suivantes demandees au defilement ou apres un filtre, independamment.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Card {
  id: string | number
  img: string
  nom: string
  annee: string
  marque: string
  collection: string
  variation: string
  rc: boolean
  auto: boolean
  patch: boolean
  num: string
  created_at?: string | null
  is_horizontal: boolean
  user_id: string
  display_name?: string
  avatar_url?: string | null
  accent: string
  disponible_vente?: boolean
  source: 'manuel' | 'csv'
  cardUrl: string
}

function parseNumDenom(num: string): number {
  if (!num) return Infinity
  const m = num.match(/\/(\d+)/)
  if (m) return parseInt(m[1])
  const n = parseInt(num.replace(/\D/g, ''))
  return isNaN(n) ? Infinity : n
}
function rareScore(c: Card): number {
  if (parseNumDenom(c.num) === 1) return 0
  if (c.auto && c.patch) return 1
  if (c.auto && !!c.num) return 2
  if (c.patch && !!c.num) return 3
  if (c.auto) return 4
  if (c.patch) return 5
  if (c.rc && !!c.num) return 6
  if (!!c.num) return 7
  if (c.rc) return 8
  return 9
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
  const playerName = sp.get('name')?.trim()
  if (!playerName || playerName.length > 80) return NextResponse.json({ cards: [], total: 0, hasMore: false })
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  const limit = Math.min(96, Math.max(1, parseInt(sp.get('limit') || '48', 10) || 48))
  const sort = sp.get('sort') || 'default'
  const fRc = sp.get('rc') === '1'
  const fAuto = sp.get('auto') === '1'
  const fPatch = sp.get('patch') === '1'
  const fNum = sp.get('num') === '1'
  const fVente = sp.get('vente') === '1'
  const myId = sp.get('myId') || null
  const myMode = sp.get('myMode') || 'all' // all | only | exclude

  const normTarget = normalizeName(playerName)
  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  const all: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, rc, auto, num, patch, marque, collection, variation, image_recto, is_horizontal, disponible_vente, created_at, user_id, profiles(display_name, avatar_url, couleur_bordure)')
      .ilike('nom', `%${firstName}%`)
      .ilike('nom', `%${lastName}%`)
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < 1000) break
  }
  const matchedManu = all.filter((m: any) => normalizeName(m.nom || '').includes(normTarget))

  const manuellesCards: Card[] = matchedManu.map((m: any) => ({
    id: m.id, img: m.image_recto, nom: m.nom, annee: m.annee, marque: m.marque, collection: m.collection,
    variation: m.variation || '', rc: m.rc || false, auto: m.auto || false, patch: m.patch || false, num: m.num || '',
    created_at: m.created_at || null, is_horizontal: m.is_horizontal, user_id: m.user_id,
    display_name: m.profiles?.display_name, avatar_url: m.profiles?.avatar_url, accent: m.profiles?.couleur_bordure || '#003DA6',
    disponible_vente: m.disponible_vente || false, source: 'manuel' as const,
    cardUrl: cardPageUrl(m.user_id, { nom: m.nom, annee: m.annee, marque: m.marque, collection: m.collection, image_recto: m.image_recto }),
  }))

  // .limit(200) laissait de cote les profils CSV au-dela des 200 premiers
  // (498 profils ont un lien_csv) -- meme bug/fix que dans page.tsx.
  const profilesData: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
      .not('lien_csv', 'is', null)
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    profilesData.push(...data)
    if (data.length < 1000) break
  }
  const csvAll = await fetchCsvCardsForProfiles(profilesData)
  const csvCards: Card[] = csvAll
    .filter(c => normalizeName(c.name).includes(normTarget))
    .map(c => ({
      id: `csv-${c.user_id}-${c.img}`, img: c.img, nom: c.name, annee: c.year, marque: c.brand, collection: '',
      variation: c.variant || '', rc: c.rc || false, auto: c.auto || false, patch: c.patch || false, num: c.num || '',
      is_horizontal: false, user_id: c.user_id, display_name: c.display_name, avatar_url: c.avatar_url, accent: c.accent,
      source: 'csv' as const, cardUrl: `/galerie/${c.user_id}`,
    }))

  const seen = new Set<string>()
  let cards = [...manuellesCards, ...csvCards].filter(c => {
    if (seen.has(c.img)) return false
    seen.add(c.img)
    return true
  })

  cards = cards.filter(c =>
    (!fRc || c.rc) && (!fAuto || c.auto) && (!fPatch || c.patch) && (!fNum || !!c.num) && (!fVente || c.disponible_vente) &&
    (myMode === 'all' || (myMode === 'only' ? c.user_id === myId : c.user_id !== myId))
  )

  if (sort === 'y_desc') cards = [...cards].sort((a, b) => (b.annee || '').localeCompare(a.annee || ''))
  else if (sort === 'y_asc') cards = [...cards].sort((a, b) => (a.annee || '').localeCompare(b.annee || ''))
  else if (sort === 'name') cards = [...cards].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
  else if (sort === 'date_desc') cards = [...cards].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  else if (sort === 'num_asc') cards = [...cards].sort((a, b) => parseNumDenom(a.num) - parseNumDenom(b.num))
  else if (sort === 'rare') cards = [...cards].sort((a, b) => rareScore(a) - rareScore(b) || parseNumDenom(a.num) - parseNumDenom(b.num))

  const total = cards.length
  const page = cards.slice(offset, offset + limit)
  return NextResponse.json({ cards: page, total, hasMore: offset + limit < total })
}
