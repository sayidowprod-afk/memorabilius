import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 20

// Service role -- doit pouvoir chercher les cartes de TOUS les utilisateurs
// (cartes_manuelles restreint SELECT a son propre user_id via RLS), meme
// logique que les autres routes admin/service qui contournent RLS.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CardSearchResult {
  source: 'manuelle' | 'set'
  key: string
  label: string
  sub: string
  image_recto: string
  image_recto_hd: string | null
  image_verso: string | null
  image_verso_hd: string | null
  is_horizontal: boolean
  manuelle_id: string | null
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })
  const safeQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_')

  const [{ data: manuelles }, { data: setEntries }] = await Promise.all([
    admin.from('cartes_manuelles')
      .select('id, nom, equipe, annee, marque, image_recto, image_recto_hd, image_verso, image_verso_hd, is_horizontal, user_id')
      .or(`nom.ilike.%${safeQ}%,equipe.ilike.%${safeQ}%,marque.ilike.%${safeQ}%`)
      .limit(60),
    admin.from('card_set_entries')
      .select('id, player_name, card_number, image_url, is_rc, card_sets(name, year, brand)')
      .ilike('player_name', `%${safeQ}%`)
      .not('image_url', 'is', null)
      .limit(40),
  ])

  // Respecte les cartes marquees privees par leur proprietaire (meme filtre
  // que /api/recherche) -- outil admin ou non, on n'expose pas une carte que
  // le collectionneur a explicitement masquee.
  const userIds = [...new Set((manuelles || []).map(m => m.user_id))]
  const { data: privees } = userIds.length > 0
    ? await admin.from('cartes_privees').select('user_id, card_key').in('user_id', userIds)
    : { data: null }
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))

  const results: CardSearchResult[] = []

  for (const m of manuelles || []) {
    if (!m.image_recto || privateSet.has(`${m.user_id}::${m.image_recto}`)) continue
    results.push({
      source: 'manuelle', key: `m:${m.id}`,
      label: m.nom || 'Carte', sub: [m.marque, m.annee, m.equipe].filter(Boolean).join(' · '),
      image_recto: m.image_recto, image_recto_hd: m.image_recto_hd || null,
      image_verso: m.image_verso || null, image_verso_hd: m.image_verso_hd || null,
      is_horizontal: !!m.is_horizontal, manuelle_id: m.id,
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
    })
  }

  return NextResponse.json({ results: results.slice(0, 80) })
}
