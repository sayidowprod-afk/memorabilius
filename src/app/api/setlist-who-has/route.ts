import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

export const maxDuration = 20

const admin = createServerServiceClient()

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const words = (s: string) => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1)
const GENERIC = new Set(['panini', 'topps', 'upper', 'deck', 'leaf', 'fleer', 'basketball', 'baseball', 'football', 'hockey', 'soccer', 'nba', 'nfl', 'mlb', 'nhl', 'trading', 'cards', 'card', 'sport', 'sports'])
const specific = (name: string) => words(name).filter(w => w.length > 2 && !GENERIC.has(w) && !/^\d+$/.test(w))
const yearOk = (cardYear: string | null, y: number | null) => {
  if (!y) return true
  const a = (cardYear || '').trim()
  return !!a && (a.startsWith(String(y)) || a === String(y + 1) || a.endsWith('-' + String(y).slice(2)))
}

// POST { setId, setYear, setBrand, setName, entries: [{ id, player_name, card_number, variation }] } -> [{ entry_id, count, members: [{ id, name }] }]
// 877 · « Qui l'a ? » : pour des lignes de setlist qui me manquent, les AUTRES membres qui ont exactement cette carte (même set, numéro et variation)
// marquée « à vendre / échanger », non vendue ni réservée. Jamais mes propres cartes, jamais une carte privée.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-who-has', 60, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const setYear = typeof body?.setYear === 'number' ? body.setYear : null
  const setBrand = body?.setBrand ? String(body.setBrand) : null
  const setName = String(body?.setName || '')
  const entries = (Array.isArray(body?.entries) ? body.entries : []).slice(0, 80) as { id: number; player_name: string; card_number: string | null; variation: string | null }[]
  if (!setName || !entries.length) return NextResponse.json([])

  const names = [...new Set(entries.map(e => String(e.player_name || '').replace(/[%_,()*"\\]/g, ' ').trim()).filter(n => n.length > 2))].slice(0, 30)
  if (!names.length) return NextResponse.json([])
  const { data: cards } = await admin.from('cartes_manuelles')
    .select('user_id, nom, annee, marque, collection, collection_tag, variation, card_number, image_recto')
    .eq('disponible_vente', true).neq('user_id', user.id).not('vendue', 'is', true).not('reservee', 'is', true)
    .or(names.map(n => 'nom.ilike.' + n).join(',')).limit(1500)
  const list = cards || []
  if (!list.length) return NextResponse.json([])

  const urls = [...new Set(list.map(c => c.image_recto as string).filter(Boolean))]
  const priv = new Set<string>()
  for (let i = 0; i < urls.length; i += 200) {
    const { data: p } = await admin.from('cartes_privees').select('user_id, card_key').in('card_key', urls.slice(i, i + 200))
    for (const r of p || []) priv.add(r.user_id + '|' + r.card_key)
  }
  const sw = specific(setName)
  const inSet = (c: (typeof list)[number]) => {
    if (priv.has(c.user_id + '|' + c.image_recto)) return false
    if (!yearOk(c.annee, setYear)) return false
    const text = norm((c.marque || '') + ' ' + (c.collection || '') + ' ' + (c.collection_tag || ''))
    if (sw.length > 0) return sw.some(w => text.includes(w))
    if (setBrand && c.marque) { const nb = norm(c.marque), ns = norm(setBrand); return !nb || !ns || nb.includes(ns) || ns.includes(nb) }
    return true
  }
  const pool = list.filter(inSet)

  const found: { entry_id: number; users: string[] }[] = []
  for (const e of entries) {
    const want = norm(e.variation || ''), player = norm(e.player_name || '')
    const users = [...new Set(pool.filter(c => norm(c.nom) === player && norm(c.variation || '') === want
      && (!e.card_number || !c.card_number || norm(e.card_number) === norm(c.card_number))).map(c => c.user_id as string))]
    if (users.length) found.push({ entry_id: e.id, users })
  }
  const ids = [...new Set(found.flatMap(f => f.users.slice(0, 5)))]
  const { data: profs } = ids.length ? await admin.from('profiles').select('id, display_name').in('id', ids) : { data: [] as { id: string; display_name: string }[] }
  const nameOf = new Map((profs || []).map(p => [p.id, p.display_name || 'Un collectionneur']))
  return NextResponse.json(found.map(f => ({ entry_id: f.entry_id, count: f.users.length, members: f.users.slice(0, 5).map(id => ({ id, name: nameOf.get(id) || 'Un collectionneur' })) })))
}
