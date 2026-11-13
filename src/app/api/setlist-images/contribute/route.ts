import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

export const maxDuration = 30

const admin = createServerServiceClient()

// 859 · Les lignes d'une setlist qui n'ont pas encore d'image prennent la photo de la carte que le membre possède et a reliée à cette ligne.
// Garde-fous : on ne lit QUE les cartes du membre qui appelle (jamais une adresse envoyée par le navigateur), une carte privée n'est jamais partagée,
// et une ligne qui a déjà une image n'est jamais remplacée.
// POST { setId } -> { added }
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-images-contribute', 30, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const setId = parseInt(String(body?.setId || ''))
  if (!setId) return NextResponse.json({ error: 'Set invalide' }, { status: 400 })

  const { data: comps } = await admin.rpc('get_set_completions', { p_set_id: setId, p_user_id: user.id }) as { data: { entry_id: number; matched_card_key: string | null }[] | null }
  const linked = (comps || []).filter(c => c.matched_card_key && /^https?:\/\//.test(c.matched_card_key))
  if (!linked.length) return NextResponse.json({ added: 0 })

  // seulement les lignes encore sans image
  const ids = linked.map(c => c.entry_id).slice(0, 400)
  const { data: bare } = await admin.from('card_set_entries').select('id').in('id', ids).is('image_url', null)
  const bareIds = new Set((bare || []).map(r => r.id))
  const wanted = linked.filter(c => bareIds.has(c.entry_id))
  if (!wanted.length) return NextResponse.json({ added: 0 })

  // l'image doit être celle d'une carte de ce membre, et cette carte ne doit pas être privée
  const urls = [...new Set(wanted.map(c => c.matched_card_key as string))]
  const { data: mine } = await admin.from('cartes_manuelles').select('image_recto').eq('user_id', user.id).in('image_recto', urls)
  const own = new Set((mine || []).map(r => r.image_recto))
  let added = 0
  for (const c of wanted) {
    const url = c.matched_card_key as string
    if (!own.has(url)) continue
    const { data: isPrivate } = await admin.rpc('is_card_private', { p_owner: user.id, p_key: url })
    if (isPrivate) continue
    const { error } = await admin.from('card_set_entries').update({ image_url: url }).eq('id', c.entry_id).is('image_url', null)
    if (!error) added++
  }
  return NextResponse.json({ added })
}
