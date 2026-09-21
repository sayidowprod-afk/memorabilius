import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'

export const maxDuration = 20

// Service role -- doit pouvoir chercher les cartes de TOUS les utilisateurs
// (cartes_manuelles restreint SELECT a son propre user_id via RLS), meme
// logique que les autres routes admin/service qui contournent RLS.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CardMeta {
  brand: string | null
  year: string | null
  number: string | null
  owner: string | null
}

export interface CardSearchResult {
  source: 'manuelle' | 'set' | 'csv'
  key: string
  label: string
  sub: string
  image_recto: string
  image_recto_hd: string | null
  image_verso: string | null
  image_verso_hd: string | null
  is_horizontal: boolean
  manuelle_id: string | null
  meta: CardMeta
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })
  const ql = q.toLowerCase()
  const safeQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_')

  const [{ data: manuelles }, { data: setEntries }, { data: csvProfiles }] = await Promise.all([
    admin.from('cartes_manuelles')
      .select('id, nom, equipe, annee, marque, num, image_recto, image_recto_hd, image_verso, image_verso_hd, is_horizontal, user_id')
      .or(`nom.ilike.%${safeQ}%,equipe.ilike.%${safeQ}%,marque.ilike.%${safeQ}%`)
      .limit(60),
    admin.from('card_set_entries')
      .select('id, player_name, card_number, image_url, is_rc, card_sets(name, year, brand)')
      .ilike('player_name', `%${safeQ}%`)
      .not('image_url', 'is', null)
      .limit(40),
    // lien_csv est '' (chaine vide) pour la grande majorite des profils, pas
    // null -- .not('lien_csv','is',null) seul en laissait passer des centaines
    // et noyait les quelques vrais liens sous la limite. neq('') les ecarte.
    admin.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').not('lien_csv', 'is', null).neq('lien_csv', '').limit(200),
  ])

  // Respecte les cartes marquees privees par leur proprietaire (meme filtre
  // que /api/recherche) -- outil admin ou non, on n'expose pas une carte que
  // le collectionneur a explicitement masquee.
  const userIds = [...new Set([
    ...(manuelles || []).map(m => m.user_id),
    ...(csvProfiles || []).map(p => p.id),
  ])]
  const { data: privees } = userIds.length > 0
    ? await admin.from('cartes_privees').select('user_id, card_key').in('user_id', userIds)
    : { data: null }
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))

  // Nom du collectionneur -- deja dispo pour les profils CSV, il faut le
  // recuperer separement pour les proprietaires de cartes_manuelles.
  const manuellesUserIds = [...new Set((manuelles || []).map(m => m.user_id))]
  const { data: ownerProfiles } = manuellesUserIds.length > 0
    ? await admin.from('profiles').select('id, display_name').in('id', manuellesUserIds)
    : { data: null }
  const ownerNameById = new Map((ownerProfiles || []).map(p => [p.id, p.display_name as string | null]))

  const results: CardSearchResult[] = []

  for (const m of manuelles || []) {
    if (!m.image_recto || privateSet.has(`${m.user_id}::${m.image_recto}`)) continue
    results.push({
      source: 'manuelle', key: `m:${m.id}`,
      label: m.nom || 'Carte', sub: [m.marque, m.annee, m.equipe].filter(Boolean).join(' · '),
      image_recto: m.image_recto, image_recto_hd: m.image_recto_hd || null,
      image_verso: m.image_verso || null, image_verso_hd: m.image_verso_hd || null,
      is_horizontal: !!m.is_horizontal, manuelle_id: m.id,
      meta: { brand: m.marque || null, year: m.annee || null, number: m.num || null, owner: ownerNameById.get(m.user_id) || null },
    })
  }

  for (const e of setEntries || []) {
    if (!e.image_url) continue
    const set = (e as any).card_sets
    results.push({
      source: 'set', key: `s:${e.id}`,
      label: e.player_name, sub: [set?.brand, set?.year, e.card_number ? `#${e.card_number}` : null].filter(Boolean).join(' · '),
      image_recto: e.image_url, image_recto_hd: null,
      image_verso: null, image_verso_hd: null,
      is_horizontal: false, manuelle_id: null,
      meta: { brand: set?.brand || null, year: set?.year ? String(set.year) : null, number: e.card_number || null, owner: null },
    })
  }

  // Cartes importées via CSV (Google Sheets) -- pas stockées en base, donc
  // absentes de cartes_manuelles ; il faut les récupérer/parser à la volée
  // par profil (module partagé avec CardPicker/equipe/joueur).
  const csvCards = await fetchCsvCardsForProfiles(csvProfiles || [])
  csvCards.forEach((c, idx) => {
    if (!c.img) return
    const match = c.name.toLowerCase().includes(ql) || c.team.toLowerCase().includes(ql)
      || c.brand.toLowerCase().includes(ql) || c.variant.toLowerCase().includes(ql)
    if (!match || privateSet.has(`${c.user_id}::${c.img}`)) return
    results.push({
      source: 'csv', key: `c:${c.user_id}:${idx}`,
      label: c.name || 'Carte', sub: [c.brand, c.year, c.team].filter(Boolean).join(' · '),
      image_recto: c.img, image_recto_hd: null,
      image_verso: c.back || null, image_verso_hd: null,
      is_horizontal: false, manuelle_id: null,
      meta: { brand: c.brand || null, year: c.year || null, number: c.num || null, owner: c.display_name || null },
    })
  })

  return NextResponse.json({ results: results.slice(0, 80) })
}
