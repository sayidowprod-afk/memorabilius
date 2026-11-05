import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { resolveProfileBySlugParam } from '@/lib/resolveProfileSlug'

export const maxDuration = 30

const supabase = createServerServiceClient()

type Card = { id: string; nom: string; annee: string | null; marque: string | null; collection: string | null; variation: string | null; num: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null; image_recto: string | null }
type Wish = { nom: string; annee: string | null; marque: string | null; collection: string | null; variation: string | null; num: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null }

const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Une carte correspond à une ligne de wishlist si le joueur y est et que chaque précision demandée (année, marque, collection, variation, numérotation, RC/auto/patch) est respectée.
function matches(w: Wish, c: Card): boolean {
  const wn = norm(w.nom), cn = norm(c.nom)
  if (!wn || !cn || !(cn.includes(wn) || wn.includes(cn))) return false
  if (w.annee && !norm(c.annee).includes(norm(w.annee).slice(0, 4))) return false
  if (w.marque && !norm(c.marque).includes(norm(w.marque))) return false
  if (w.collection && !norm(c.collection).includes(norm(w.collection))) return false
  if (w.variation && !norm(c.variation).includes(norm(w.variation))) return false
  if (w.num && !norm(c.num).includes(norm(w.num))) return false
  if (w.rc && !c.rc) return false
  if (w.auto && !c.auto) return false
  if (w.patch && !c.patch) return false
  return true
}

async function allCards(userId: string): Promise<Card[]> {
  const out: Card[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from('cartes_manuelles')
      .select('id, nom, annee, marque, collection, variation, num, rc, auto, patch, image_recto')
      .eq('user_id', userId).order('id').range(from, from + 999)
    if (error || !data) break
    out.push(...(data as Card[]))
    if (data.length < 1000) break
  }
  return out
}

const keyOf = (c: Card) => [c.nom, c.annee, c.marque, c.collection, c.variation, c.num].map(norm).join('|')

// GET ?friend=<uuid | pseudo | slug> : compare ma galerie avec celle d'un autre membre. Renvoie seulement les cartes concernées
// (jamais la wishlist de l'autre en entier, jamais ses cartes privées).
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const raw = new URL(req.url).searchParams.get('friend') || ''
  const target = raw ? await resolveProfileBySlugParam(supabase, raw) : null
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (target.id === user.id) return NextResponse.json({ error: 'self' }, { status: 400 })

  const [{ data: friend }, myCards, theirCardsAll, { data: myWish }, { data: theirWish }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url, slug').eq('id', target.id).maybeSingle(),
    allCards(user.id),
    allCards(target.id),
    supabase.from('wishlist').select('nom, annee, marque, collection, variation, num, rc, auto, patch').eq('user_id', user.id).limit(500),
    supabase.from('wishlist').select('nom, annee, marque, collection, variation, num, rc, auto, patch').eq('user_id', target.id).limit(500),
    supabase.from('cartes_privees').select('card_key').eq('user_id', target.id).limit(20000),
  ])
  const privateKeys = new Set((priv ?? []).map(r => r.card_key))
  const theirCards = theirCardsAll.filter(c => !(c.image_recto && privateKeys.has(c.image_recto)))

  const theirWishes = (theirWish ?? []) as Wish[]
  const myWishes = (myWish ?? []) as Wish[]
  const iHave = theirWishes.length ? myCards.filter(c => theirWishes.some(w => matches(w, c))) : []
  const theyHave = myWishes.length ? theirCards.filter(c => myWishes.some(w => matches(w, c))) : []

  const mine = new Set(myCards.map(keyOf))
  const commonAll = theirCards.filter(c => mine.has(keyOf(c)))

  const slim = (c: Card) => ({ id: c.id, nom: c.nom, annee: c.annee, marque: c.marque, collection: c.collection, variation: c.variation, num: c.num, image: c.image_recto })
  return NextResponse.json({
    friend: friend ?? { id: target.id, display_name: null, avatar_url: null, slug: target.slug },
    counts: { mine: myCards.length, theirs: theirCards.length, myWishlist: myWishes.length },
    iHave: iHave.slice(0, 60).map(slim), iHaveTotal: iHave.length,
    theyHave: theyHave.slice(0, 60).map(slim), theyHaveTotal: theyHave.length,
    common: commonAll.slice(0, 60).map(slim), commonTotal: commonAll.length,
  })
}
