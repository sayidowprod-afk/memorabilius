import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { isBasketballTeam } from '@/lib/basketballTeamMatch'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Autres cartes AUTO basket du meme joueur (doublons entre utilisateurs,
// variantes...) -- pour le bouton "Autre carte" quand la photo choisie par
// /api/admin/autograph-candidates est floue, mal cadree, ou a un
// is_horizontal errone en base.
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'name manquant' }, { status: 400 })

  const { data, error } = await admin
    .from('cartes_manuelles')
    .select('id, equipe, image_recto, is_horizontal, user_id, rc, patch, num, annee, marque, collection, created_at')
    .eq('auto', true)
    .ilike('nom', name)
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matched = (data || []).filter(c => isBasketballTeam(c.equipe))
  const ownerIds = [...new Set(matched.map(c => c.user_id).filter(Boolean))]
  const { data: profiles } = ownerIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const ownerNames = new Map((profiles || []).map(p => [p.id, p.display_name]))

  const alternates = matched.map(c => ({
    id: c.id, equipe: c.equipe, image: c.image_recto, isHorizontal: !!c.is_horizontal,
    rc: !!c.rc, patch: !!c.patch, num: c.num, annee: c.annee, marque: c.marque, collection: c.collection,
    ownerName: ownerNames.get(c.user_id) || null,
  }))

  return NextResponse.json({ alternates })
}
