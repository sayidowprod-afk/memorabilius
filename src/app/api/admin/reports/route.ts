import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: feedback }, { data: reports }] = await Promise.all([
    admin.from('user_feedback').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
  ])

  // Enrichit avec les pseudos (les deux tables ne stockent que des ids) --
  // une seule requete groupee plutot qu'un aller-retour par ligne.
  const ids = [...new Set([
    ...(feedback || []).map(f => f.user_id).filter(Boolean),
    ...(reports || []).flatMap(r => [r.reporter_id, r.reported_user_id]).filter(Boolean),
  ])]
  const { data: profiles } = ids.length
    ? await admin.from('profiles').select('id, display_name').in('id', ids)
    : { data: [] }
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))

  return NextResponse.json({
    feedback: (feedback || []).map(f => ({ ...f, user_name: f.user_id ? nameMap[f.user_id] || null : null })),
    reports: (reports || []).map(r => ({
      ...r,
      reporter_name: nameMap[r.reporter_id] || null,
      reported_user_name: r.reported_user_id ? nameMap[r.reported_user_id] || null : null,
    })),
  })
}
