import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'
import { matchesEntryExact, norm, setCouldMatchCard, type MCard, type MEntry, type MSet } from '@/lib/setMatcher'

export const maxDuration = 30

const admin = createServerServiceClient()
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

interface MyCard extends MCard { image_recto: string | null; image_recto_thumb: string | null; jeu?: string | null }

// GET : « Mes Rainbows » : pour chaque joueur dont j'ai plusieurs cartes d'un même produit (Prizm 2021, Mosaic 2024…), combien de parallèles de sa carte j'ai,
// sur combien existent dans la setlist. Mêmes règles de correspondance que les setlists (lib/setMatcher.ts, variation identique).
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'mes-rainbows', 12, 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { data: all } = await admin.from('cartes_manuelles')
    .select('nom, annee, marque, collection, collection_tag, variation, card_number, image_recto, image_recto_thumb, jeu')
    .eq('user_id', user.id).not('image_recto', 'is', null).limit(4000)
  const cards = ((all || []) as MyCard[]).filter(c => !c.jeu && c.nom && c.collection && c.annee && c.nom !== 'Carte à compléter')

  // joueurs + produit + année avec au moins 2 cartes
  const groups = new Map<string, MyCard[]>()
  for (const c of cards) { const k = norm(c.nom) + '|' + norm(c.annee) + '|' + norm(c.collection); groups.set(k, [...(groups.get(k) || []), c]) }
  const top = [...groups.values()].filter(g => g.length >= 2).sort((a, b) => b.length - a.length).slice(0, 14)

  const out: { player: string; setId: number; setName: string; cardNumber: string | null; owned: number; total: number; thumb: string | null; image: string | null }[] = []
  const work = async (g: MyCard[]) => {
    const c0 = g[0]
    const yr = parseInt(String(c0.annee).slice(0, 4))
    if (!yr) return
    const words = String(c0.collection).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
    let qb = admin.from('card_sets').select('id, name, year, brand').eq('year', yr).limit(40)
    if (words[0]) qb = qb.ilike('name', '%' + words[0] + '%')
    const { data: sets } = await qb
    const cand = ((sets || []) as MSet[]).filter(s => setCouldMatchCard(c0, s))
    for (const set of cand.slice(0, 3)) {
      const { data: es } = await admin.from('card_set_entries').select('id, card_number, variation, player_name').eq('set_id', set.id).ilike('player_name', String(c0.nom).trim()).limit(600)
      if (!es?.length) continue
      const byNum = new Map<string, MEntry[]>()
      for (const e of es) { const k = e.card_number || '—'; byNum.set(k, [...(byNum.get(k) || []), { id: e.id, player_name: e.player_name, card_number: e.card_number, variation: e.variation, set_id: set.id }]) }
      let best: { num: string; owned: number; total: number; img: MyCard | null } | null = null
      for (const [num, list] of byNum) {
        let owned = 0, img: MyCard | null = null
        for (const e of list) { const hit = g.find(c => matchesEntryExact(c, e, set)); if (hit) { owned++; img = img || hit } }
        if (owned > 0 && list.length >= 3 && (!best || owned / list.length > best.owned / best.total || (owned / list.length === best.owned / best.total && list.length > best.total))) best = { num, owned, total: list.length, img }
      }
      if (best) { out.push({ player: c0.nom, setId: set.id, setName: set.name, cardNumber: best.num === '—' ? null : best.num, owned: best.owned, total: best.total, thumb: best.img?.image_recto_thumb || best.img?.image_recto || null, image: best.img?.image_recto || null }); return }
    }
  }
  for (const part of chunk(top, 4)) await Promise.all(part.map(work))
  out.sort((a, b) => b.owned / b.total - a.owned / a.total || b.owned - a.owned)
  return NextResponse.json({ rainbows: out })
}
