import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cartes des galeries correspondant a un set (annee + mot du produit), pour le generateur de guides (tirages et photos des parallèles / inserts).
// Cote serveur (cle service-role) : la RLS de cartes_manuelles limite chaque utilisateur, admin compris, a SES propres cartes dans le navigateur.
// Reserve aux admins. Les cartes privees (cartes_privees) et celles d'un autre sport sont exclues ici, pour qu'aucune photo masquee ne sorte.
export const maxDuration = 30

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const year = Number(req.nextUrl.searchParams.get('year'))
  const pattern = (req.nextUrl.searchParams.get('pattern') || '').replace(/[%_\\,()]/g, ' ').trim()
  const sport = (req.nextUrl.searchParams.get('sport') || '').toLowerCase()
  const exact = req.nextUrl.searchParams.get('exact') === '1'
  if (!year || !pattern) return NextResponse.json({ cards: [] })

  type Row = { user_id: string; collection: string | null; variation: string | null; num: string | null; image_recto: string | null }
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    // exact : produit reduit a la marque (« Topps ») -> collection « Topps » ou « Topps Basketball », pas « Topps Chrome »
    const sportWord = ({ nba: 'Basketball', wnba: 'Basketball', nfl: 'Football', mlb: 'Baseball', nhl: 'Hockey', football: 'Soccer' } as Record<string, string>)[sport] || ''
    let q = supabase.from('cartes_manuelles').select('user_id, collection, variation, num, image_recto')
    q = exact
      ? q.or(`collection.ilike.${pattern},collection.ilike.${pattern} ${sportWord || 'zzzz'}`)
      : q.ilike('collection', `%${pattern}%`)
    const { data } = await q.ilike('annee', `%${year}%`).not('image_recto', 'is', null).order('id').range(from, from + 999)
    if (!data?.length) break
    rows.push(...(data as Row[]))
    if (data.length < 1000 || rows.length >= 8000) break
  }
  // sport : « Mosaic Football » ne doit pas alimenter le guide d'un set de basket
  const other = /football|baseball|soccer|hockey|wnba/i
  const mine = new RegExp(sport === 'nba' ? 'basketball' : sport || 'zzzz', 'i')
  const kept = rows.filter(c => !(c.collection && other.test(c.collection) && !mine.test(c.collection)))

  const priv = new Set<string>()
  const users = [...new Set(kept.map(c => c.user_id))]
  for (let i = 0; i < users.length; i += 40) {
    const { data } = await supabase.from('cartes_privees').select('card_key').in('user_id', users.slice(i, i + 40)).limit(5000)
    for (const p of data || []) priv.add(p.card_key)
  }
  const cards = kept.filter(c => c.image_recto && !priv.has(c.image_recto)).map(c => ({ variation: c.variation, num: c.num, image_recto: c.image_recto }))
  return NextResponse.json({ cards })
}
