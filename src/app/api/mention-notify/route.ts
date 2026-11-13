import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'
import { sendPushToUser } from '@/lib/pushNotify'

const admin = createServerServiceClient()
const MENTION = /@([\p{L}\p{N}_.-]{2,30})/gu
const tokenOf = (n: string) => n.trim().replace(/\s+/g, '_').toLowerCase()

// POST { message, lien } : prévient les membres @mentionnés dans un commentaire que je viens de publier (5 au maximum, jamais moi-même).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'mention-notify', 30, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const message = String(body?.message || '').slice(0, 500)
  const lien = String(body?.lien || '/').startsWith('/') ? String(body.lien).slice(0, 300) : '/'
  const tokens = [...new Set([...message.matchAll(MENTION)].map(m => m[1].toLowerCase()))].slice(0, 5)
  if (!tokens.length) return NextResponse.json({ ok: true, notified: 0 })

  const found = new Map<string, { id: string; display_name: string }>()
  for (const t of tokens) {
    const { data } = await admin.from('profiles').select('id, display_name').ilike('display_name', t.replace(/_/g, '_').replace(/[%,()]/g, ' ')).limit(5)
    const hit = (data || []).find(p => tokenOf(p.display_name || '') === t)
    if (hit && hit.id !== user.id) found.set(hit.id, hit)
  }
  if (!found.size) return NextResponse.json({ ok: true, notified: 0 })

  const { data: me } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const who = me?.display_name || 'Un membre'
  const text = who + ' t’a mentionné : « ' + message.replace(/\s+/g, ' ').slice(0, 80) + (message.length > 80 ? '…' : '') + ' »'
  let notified = 0
  for (const p of found.values()) {
    const { error } = await admin.from('notifications').insert({ user_id: p.id, type: 'mention', message: text, lien, lu: false })
    if (!error) { notified++; await Promise.allSettled([sendPushToUser(p.id, { title: who + ' t’a mentionné', body: message.slice(0, 100), url: lien, channelId: 'community' })]) }
  }
  return NextResponse.json({ ok: true, notified })
}
