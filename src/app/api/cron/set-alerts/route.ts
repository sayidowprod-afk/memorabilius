import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { isChannelAllowed, sendPushToUser } from '@/lib/pushNotify'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { matchesEntryExact, norm, setCouldMatchCard, type MCard, type MEntry, type MSet } from '@/lib/setMatcher'

export const maxDuration = 120

const supabase = createServerServiceClient()
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
const pool = async <T,>(items: T[], n: number, fn: (x: T) => Promise<void>) => { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x) } })) }

interface Listing extends MCard { id: string; user_id: string; image_recto: string | null }

// Quotidien : des cartes viennent d'être mises à l'échange. Pour les membres qui COLLECTIONNENT un set (au moins 10 cartes cochées dedans),
// on les prévient quand une carte qui leur MANQUE dans ce set est proposée (une seule notification par membre et par jour).
// Même moteur de correspondance que les setlists (lib/setMatcher.ts), variation identique ; jamais une carte privée, jamais sa propre carte.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date(Date.now() - 30 * 3600 * 1000).toISOString()
  const { data: fresh } = await supabase.from('cartes_manuelles')
    .select('id, user_id, nom, annee, marque, collection, collection_tag, variation, card_number, image_recto')
    .eq('disponible_vente', true).not('vendue', 'is', true).not('reservee', 'is', true).not('image_recto', 'is', null)
    .gte('created_at', since).limit(400)
  const listings = ((fresh || []) as Listing[]).filter(c => c.nom && c.collection && c.annee && c.nom !== 'Carte à compléter')
  if (!listings.length) return NextResponse.json({ ok: true, listings: 0, notified: 0 })

  // cartes privées : écartées
  const urls = [...new Set(listings.map(l => l.image_recto as string))]
  const priv = new Set<string>()
  for (const part of chunk(urls, 200)) { const { data } = await supabase.from('cartes_privees').select('card_key').in('card_key', part); for (const r of data || []) priv.add(r.card_key) }

  // 1) chaque carte proposée -> sa ligne de setlist
  const found: { listing: Listing; set: MSet; entry: MEntry }[] = []
  await pool(listings.filter(l => !priv.has(l.image_recto as string)).slice(0, 250), 6, async l => {
    const yr = parseInt(String(l.annee).slice(0, 4)); if (!yr) return
    const w = String(l.collection).toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2)[0]
    let qb = supabase.from('card_sets').select('id, name, year, brand').eq('year', yr).limit(30)
    if (w) qb = qb.ilike('name', '%' + w + '%')
    const { data: sets } = await qb
    for (const set of ((sets || []) as MSet[]).filter(s => setCouldMatchCard(l, s)).slice(0, 2)) {
      const { data: es } = await supabase.from('card_set_entries').select('id, player_name, card_number, variation').eq('set_id', set.id).ilike('player_name', String(l.nom).trim()).limit(400)
      for (const e of es || []) {
        const entry: MEntry = { id: e.id, player_name: e.player_name, card_number: e.card_number, variation: e.variation, set_id: set.id }
        if (norm(e.player_name) === norm(l.nom) && matchesEntryExact(l, entry, set)) { found.push({ listing: l, set, entry }); return }
      }
    }
  })
  if (!found.length) return NextResponse.json({ ok: true, listings: listings.length, matched: 0, notified: 0 })

  // 2) ce que chaque membre a déjà coché, et dans quels sets il en a au moins 10
  const comps: { user_id: string; entry_id: number }[] = []
  for (let o = 0; o < 200000; o += 1000) {
    const { data } = await supabase.from('user_set_completion').select('user_id, entry_id').order('id').range(o, o + 999)
    comps.push(...((data || []) as typeof comps)); if (!data || data.length < 1000) break
  }
  const entrySet = new Map<number, number>()
  const ids = [...new Set(comps.map(c => c.entry_id))]
  await pool(chunk(ids, 400), 8, async part => { const { data } = await supabase.from('card_set_entries').select('id, set_id').in('id', part); for (const r of data || []) entrySet.set(r.id, r.set_id) })
  const owned = new Map<string, Set<number>>(), perSet = new Map<string, Map<number, number>>()
  for (const c of comps) {
    const set = entrySet.get(c.entry_id); if (!set) continue
    if (!owned.has(c.user_id)) owned.set(c.user_id, new Set())
    owned.get(c.user_id)!.add(c.entry_id)
    const m = perSet.get(c.user_id) || new Map<number, number>(); m.set(set, (m.get(set) || 0) + 1); perSet.set(c.user_id, m)
  }

  // 3) pour chaque membre : les cartes proposées qui lui manquent dans ses sets
  const today = new Date().toISOString().slice(0, 10), tag = '#sa-' + today
  const byUser = new Map<string, { name: string; setName: string; setId: number; from: string }[]>()
  for (const f of found) {
    for (const [uid, sets] of perSet) {
      if (uid === f.listing.user_id) continue
      if ((sets.get(f.set.id) || 0) < 10 || owned.get(uid)?.has(f.entry.id)) continue
      byUser.set(uid, [...(byUser.get(uid) || []), { name: f.listing.nom, setName: f.set.name, setId: f.set.id, from: f.listing.user_id }])
    }
  }
  let notified = 0
  for (const [uid, list] of byUser) {
    const { data: already } = await supabase.from('notifications').select('id').eq('user_id', uid).eq('type', 'set_alert').like('lien', '%' + tag).limit(1)
    if (already?.length) continue
    if (!(await isChannelAllowed(uid, 'wishlist'))) continue
    const first = list[0], more = list.length - 1
    const message = list.length === 1
      ? 'Une carte qui te manque est à l’échange : ' + first.name + ' (' + first.setName + ').'
      : list.length + ' cartes qui te manquent sont à l’échange : ' + first.name + ' (' + first.setName + ')' + (more > 0 ? ' et ' + more + ' autre' + (more > 1 ? 's' : '') : '') + '.'
    const lien = '/setlist/' + first.setId + tag
    const { error } = await supabase.from('notifications').insert({ user_id: uid, type: 'set_alert', message, lien, lu: false })
    if (error) continue
    notified++
    await Promise.allSettled([sendPushToUser(uid, { title: 'À l’échange dans tes sets', body: message, url: lien, channelId: 'wishlist' })])
  }
  return NextResponse.json({ ok: true, listings: listings.length, matched: found.length, notified })
}
