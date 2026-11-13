import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()

// Toutes les demandes de setlist (sauf refusées anciennes), avec le nombre de « Moi aussi », les plus attendues d'abord.
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: rows, error } = await admin.from('setlist_requests').select('id, sport, name, link, status, set_id, created_at').order('created_at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = (rows || []).map(r => r.id)
  const { data: votes } = ids.length ? await admin.from('setlist_request_votes').select('request_id').in('request_id', ids) : { data: [] as { request_id: string }[] }
  const count = new Map<string, number>()
  for (const v of votes || []) count.set(v.request_id, (count.get(v.request_id) || 0) + 1)
  const open = (s: string) => (s === 'demandee' || s === 'en_cours' ? 0 : 1)
  const requests = (rows || []).map(r => ({ ...r, votes: count.get(r.id) || 0 })).sort((a, b) => open(a.status) - open(b.status) || b.votes - a.votes)
  return NextResponse.json({ requests })
}
