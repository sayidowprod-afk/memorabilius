import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

const admin = createServerServiceClient()

const SPORTS = ['nba', 'euro-basketball', 'wnba', 'nfl', 'baseball', 'hockey', 'soccer-international', 'racing', 'tennis', 'wrestling', 'mma', 'pokemon', 'mtg', 'non-sport', 'autre']
const nameKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

async function userOf(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await admin.auth.getUser(token)
  return user
}

// GET : les demandes en cours (et celles ajoutées depuis 60 jours), avec le nombre de « Moi aussi » et ce qui me concerne.
export async function GET(req: NextRequest) {
  const user = await userOf(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-requests-get', 60, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data: rows, error } = await admin.from('setlist_requests').select('id, sport, name, status, set_id, created_by, created_at')
    .or(`status.in.(demandee,en_cours),and(status.eq.ajoutee,updated_at.gte.${since})`).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ requests: [], unavailable: true })
  const ids = (rows || []).map(r => r.id)
  const { data: votes } = ids.length ? await admin.from('setlist_request_votes').select('request_id, user_id').in('request_id', ids) : { data: [] as { request_id: string; user_id: string }[] }
  const count = new Map<string, number>(), mine = new Set<string>()
  for (const v of votes || []) { count.set(v.request_id, (count.get(v.request_id) || 0) + 1); if (v.user_id === user.id) mine.add(v.request_id) }
  const requests = (rows || []).map(r => ({ id: r.id, sport: r.sport, name: r.name, status: r.status, set_id: r.set_id, created_at: r.created_at, votes: count.get(r.id) || 0, voted: mine.has(r.id), mine: r.created_by === user.id }))
    .sort((a, b) => (a.status === 'ajoutee' ? 1 : 0) - (b.status === 'ajoutee' ? 1 : 0) || b.votes - a.votes)
  return NextResponse.json({ requests })
}

// POST { sport, name, link? } : crée une demande, ou si la même est déjà ouverte, ajoute simplement mon « Moi aussi ».
export async function POST(req: NextRequest) {
  const user = await userOf(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-requests-post', 10, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const sport = String(body?.sport || ''), name = String(body?.name || '').trim().slice(0, 200), link = String(body?.link || '').trim().slice(0, 300)
  if (!SPORTS.includes(sport) || name.length < 3) return NextResponse.json({ error: 'Demande invalide' }, { status: 400 })
  const key = nameKey(name)
  if (key.length < 3) return NextResponse.json({ error: 'Demande invalide' }, { status: 400 })

  let { data: existing } = await admin.from('setlist_requests').select('id').eq('sport', sport).eq('name_key', key).in('status', ['demandee', 'en_cours']).maybeSingle()
  if (!existing) {
    const { data: created, error } = await admin.from('setlist_requests').insert({ sport, name, name_key: key, link: link || null, created_by: user.id }).select('id').single()
    if (error) {
      // une demande identique vient d'être créée entre-temps : on la retrouve
      const again = await admin.from('setlist_requests').select('id').eq('sport', sport).eq('name_key', key).in('status', ['demandee', 'en_cours']).maybeSingle()
      if (!again.data) return NextResponse.json({ error: error.message }, { status: 500 })
      existing = again.data
    } else existing = created
  }
  await admin.from('setlist_request_votes').upsert({ request_id: existing!.id, user_id: user.id }, { onConflict: 'request_id,user_id', ignoreDuplicates: true })
  return NextResponse.json({ ok: true, id: existing!.id })
}
