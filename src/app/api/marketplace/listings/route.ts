import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { getMarketplaceUser } from '@/lib/marketplaceAccess'

export const maxDuration = 30

const supabase = createServerServiceClient()

const clean = (s: string) => s.replace(/[%_,()*]/g, ' ').trim()

// Annonces de la marketplace : cartes avec un prix de vente, non marquées vendues.
// Réservé aux utilisateurs autorisés (bêta privée) -- vérifié ici, côté serveur.
export async function GET(req: NextRequest) {
  const user = await getMarketplaceUser(req)
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  // typé large : l'enchaînement dynamique de filtres fait déborder l'inférence de types de supabase-js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('cartes_manuelles')
    .select('id, user_id, nom, equipe, annee, collection, marque, variation, grade, num, rc, auto, patch, image_recto, prix_vente, created_at, cert_number', { count: 'exact' })
    .not('prix_vente', 'is', null)
    .or('vendue.is.null,vendue.eq.false')

  // Chaque mot doit se retrouver quelque part (nom, collection, marque, variation).
  for (const w of clean(sp.get('q') || '').split(/\s+/).filter(Boolean)) {
    q = q.or(`nom.ilike.%${w}%,collection.ilike.%${w}%,marque.ilike.%${w}%,variation.ilike.%${w}%`)
  }
  const year = clean(sp.get('year') || '')
  if (year) q = q.ilike('annee', `${year}%`)
  const grade = sp.get('grade')
  if (grade === 'raw') q = q.or('grade.is.null,grade.ilike.raw')
  else if (grade === 'graded') q = q.not('grade', 'is', null).not('grade', 'ilike', 'raw')
  if (sp.get('rc') === '1') q = q.eq('rc', true)
  if (sp.get('auto') === '1') q = q.eq('auto', true)
  if (sp.get('patch') === '1') q = q.eq('patch', true)
  const min = Number(sp.get('min')), max = Number(sp.get('max'))
  if (Number.isFinite(min) && sp.get('min')) q = q.gte('prix_vente', min)
  if (Number.isFinite(max) && sp.get('max')) q = q.lte('prix_vente', max)

  const sort = sp.get('sort')
  q = sort === 'price_asc' ? q.order('prix_vente', { ascending: true })
    : sort === 'price_desc' ? q.order('prix_vente', { ascending: false })
    : q.order('created_at', { ascending: false })

  const limit = Math.min(Math.max(Number(sp.get('limit')) || 120, 1), 200)
  const offset = Math.max(Number(sp.get('offset')) || 0, 0)
  const { data, count, error } = await q.range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = [...new Set((data || []).map((c: { user_id: string }) => c.user_id))]
  const sellers: Record<string, unknown> = {}
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url, slug').in('id', ids)
    for (const p of profs || []) sellers[p.id] = p
  }
  return NextResponse.json({ listings: data || [], total: count ?? 0, sellers })
}
