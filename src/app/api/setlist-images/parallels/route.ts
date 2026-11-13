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

// POST { setId, setYear, setBrand, setName, player, entries: [{ id, card_number, variation }] } -> [{ entry_id, image_url }]
// 852 · Photo de la communauté pour une PARALLÈLE précise : seulement une carte dont l'année, le set, le numéro ET la variation correspondent exactement
// à la ligne (jamais « une carte du même joueur à peu près »). Une carte privée n'est jamais montrée. S'il n'y en a pas, aucune image n'est renvoyée.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'setlist-images-parallels', 120, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const player = String(body?.player || '').trim()
  const setYear = typeof body?.setYear === 'number' ? body.setYear : null
  const setBrand = body?.setBrand ? String(body.setBrand) : null
  const setName = String(body?.setName || '')
  const entries = (Array.isArray(body?.entries) ? body.entries : []).slice(0, 200) as { id: number; card_number: string | null; variation: string | null }[]
  if (!player || !setName || !entries.length) return NextResponse.json([])

  const { data: cards } = await admin.from('cartes_manuelles')
    .select('id, user_id, nom, equipe, annee, marque, collection, collection_tag, variation, card_number, num, grade, rc, auto, patch, image_recto, image_verso, image_recto_hd, image_verso_hd, image_recto_thumb, is_horizontal, verso_is_horizontal, format, booklet, image_interieur_gauche, image_interieur_droite, quantite')
    .ilike('nom', player.replace(/[%_]/g, ' ')).not('image_recto', 'is', null).neq('image_recto', '').limit(800)
  const urls = [...new Set((cards || []).map(c => c.image_recto as string))]
  // cartes privées : jamais partagées
  const priv = new Set<string>()
  for (let i = 0; i < urls.length; i += 200) {
    const { data: p } = await admin.from('cartes_privees').select('user_id, card_key').in('card_key', urls.slice(i, i + 200))
    for (const r of p || []) priv.add(r.user_id + '|' + r.card_key)
  }

  const sw = specific(setName)
  const inSet = (c: NonNullable<typeof cards>[number]) => {
    if (c.image_recto?.includes('placehold') || priv.has(c.user_id + '|' + c.image_recto)) return false
    if (!yearOk(c.annee, setYear)) return false
    const text = norm((c.marque || '') + ' ' + (c.collection || '') + ' ' + (c.collection_tag || ''))
    if (sw.length > 0) { if (!sw.some(w => text.includes(w))) return false }
    else if (setBrand && c.marque) { const nb = norm(c.marque), ns = norm(setBrand); if (nb && ns && !nb.includes(ns) && !ns.includes(nb)) return false }
    return true
  }
  const pool = (cards || []).filter(inSet)

  const out: { entry_id: number; image_url: string; card: Record<string, unknown> }[] = []
  for (const e of entries) {
    const want = norm(e.variation || '')
    // même variation ; si les deux ont un numéro il doit être identique ; on préfère une carte dont le numéro est confirmé
    const cands = pool.filter(c => norm(c.variation || '') === want && (!e.card_number || !c.card_number || norm(e.card_number) === norm(c.card_number)))
    const hit = cands.find(c => e.card_number && c.card_number) || cands[0]
    // la carte entière (champs d'affichage uniquement : ni prix, ni notes, ni liens de vente) pour l'ouvrir dans le viewer 3D, comme dans la galerie de son propriétaire
    if (hit?.image_recto) out.push({ entry_id: e.id, image_url: (hit.image_recto_thumb || hit.image_recto) as string, card: hit as unknown as Record<string, unknown> })
  }
  return NextResponse.json(out)
}
