import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimited } from '@/lib/publicRateLimit'
import { sendPushToUser } from '@/lib/pushNotify'

const admin = createServerServiceClient()

// POST /api/setlist-requests/[id] { on: boolean } : « Moi aussi » (ajouter ou retirer mon vote).
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-requests-vote', 60, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const on = body?.on !== false
  const { data: r } = await admin.from('setlist_requests').select('id, status').eq('id', id).maybeSingle()
  if (!r || !['demandee', 'en_cours'].includes(r.status)) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (on) await admin.from('setlist_request_votes').upsert({ request_id: id, user_id: user.id }, { onConflict: 'request_id,user_id', ignoreDuplicates: true })
  else await admin.from('setlist_request_votes').delete().eq('request_id', id).eq('user_id', user.id)
  const { count } = await admin.from('setlist_request_votes').select('user_id', { count: 'exact', head: true }).eq('request_id', id)
  return NextResponse.json({ ok: true, votes: count || 0, voted: on })
}

// PATCH /api/setlist-requests/[id] { status, set_id? } : réservé aux admins. Passer à « ajoutee » prévient tous ceux qui l'attendaient (une seule fois).
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const status = String(body?.status || '')
  if (!['demandee', 'en_cours', 'ajoutee', 'refusee'].includes(status)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  // accepte « 8947 » ou l'adresse de la page (…/setlist/8947) : on garde le dernier nombre
  const nums = String(body?.set_id || '').match(/\d+/g)
  const setId = nums ? nums[nums.length - 1].slice(0, 9) : null

  const { data: before } = await admin.from('setlist_requests').select('id, name, status').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { error } = await admin.from('setlist_requests').update({ status, set_id: setId ?? undefined, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let notified = 0
  if (status === 'ajoutee' && before.status !== 'ajoutee') {
    const [{ data: votes }, { data: req0 }] = await Promise.all([
      admin.from('setlist_request_votes').select('user_id').eq('request_id', id),
      admin.from('setlist_requests').select('created_by').eq('id', id).maybeSingle(),
    ])
    const who = [...new Set([...(votes || []).map(v => v.user_id), ...(req0?.created_by ? [req0.created_by] : [])])]
    if (who.length) {
      const lien = setId ? `/setlist/${setId}` : '/setlist'
      const rows = who.map(uid => ({ user_id: uid, type: 'setlist', message: `Ta demande de setlist « ${before.name} » est ajoutée !`, lien, lu: false }))
      const { error: nerr } = await admin.from('notifications').insert(rows)
      if (!nerr) notified = rows.length
      // en plus de la cloche : une notification sur le téléphone (respecte les préférences du membre ; un échec n'empêche rien)
      await Promise.allSettled(who.map(uid => sendPushToUser(uid, { title: 'Setlist ajoutée', body: 'Ta demande « ' + before.name + ' » est ajoutée !', url: lien, channelId: 'community' })))
    }
  }
  return NextResponse.json({ ok: true, notified })
}
