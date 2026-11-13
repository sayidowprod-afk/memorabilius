import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { matchesEntryExact, norm, type MCard, type MEntry, type MSet } from '@/lib/setMatcher'

export const maxDuration = 30

const admin = createServerServiceClient()
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

interface GalleryCard extends MCard { image_recto?: string }

// Photos communautaires d'une setlist : pour chaque ligne SANS image, la photo d'un membre dont la carte est EXACTEMENT cette ligne.
// Règles : celles du moteur commun de correspondance (lib/setMatcher.ts : année de début de saison, marque, produit identique, numéro) + variation IDENTIQUE.
// Avant, des règles plus souples affichaient des cartes d'un autre set ou d'une autre parallèle. Une carte privée n'est jamais utilisée.
export async function POST(req: NextRequest) {
  // Écrit dans des tables communautaires partagées (card_set_entries, entry_images) via le client service-role : appelant authentifié obligatoire.
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { setId, setYear, setBrand, setName, entryIds } = await req.json() as {
    setId: number; setYear: number | null; setBrand: string | null; setName: string; entryIds: number[]
  }
  if (!setId || !entryIds?.length) return NextResponse.json([])
  const set: MSet = { id: setId, name: setName, year: setYear, brand: setBrand }

  type Row = { id: number; player_name: string; card_number: string | null; variation: string | null }
  const entries: MEntry[] = []
  for (const part of chunk(entryIds.slice(0, 4000), 500)) {
    const { data } = await admin.from('card_set_entries').select('id, player_name, card_number, variation').in('id', part)
    for (const r of (data || []) as Row[]) entries.push({ id: r.id, player_name: r.player_name, card_number: r.card_number, variation: r.variation, set_id: setId })
  }
  if (!entries.length) return NextResponse.json([])
  const byId = new Map(entries.map(e => [e.id, e]))
  const results = new Map<number, string>()

  // cartes privées : jamais utilisées (card_key = adresse de la photo)
  const privateCache = new Map<string, boolean>()
  const filterPrivate = async (urls: string[]) => {
    const todo = [...new Set(urls)].filter(u => !privateCache.has(u))
    for (const part of chunk(todo, 200)) {
      const { data } = await admin.from('cartes_privees').select('card_key').in('card_key', part)
      const priv = new Set((data || []).map(r => r.card_key as string))
      for (const u of part) privateCache.set(u, priv.has(u))
    }
    return (u: string) => !privateCache.get(u)
  }

  // photos signalées par au moins 2 membres différents : jamais reproposées pour cette ligne
  const reportCount = new Map<string, number>()
  for (const part of chunk(entryIds.slice(0, 4000), 400)) {
    const { data } = await admin.from('setlist_photo_reports').select('entry_id, image_url').in('entry_id', part).limit(5000)
    for (const r of (data || []) as { entry_id: number; image_url: string }[]) { const k = r.entry_id + '|' + r.image_url; reportCount.set(k, (reportCount.get(k) || 0) + 1) }
  }
  const isHidden = (entryId: number, url: string) => (reportCount.get(entryId + '|' + url) || 0) >= 2

  // ─── ÉTAPE 1 : cartes de la communauté qui sont EXACTEMENT la ligne ───────────────────────────
  {
    const names = [...new Set(entries.map(e => e.player_name.trim()))]
    const { data: cards } = await admin.rpc('get_cards_for_players', { p_player_names: names }) as { data: GalleryCard[] | null }
    if (cards?.length) {
      const okPhoto = await filterPrivate(cards.map(c => c.image_recto || '').filter(Boolean))
      const byPlayer = new Map<string, GalleryCard[]>()
      for (const c of cards) {
        if (!c.image_recto || !okPhoto(c.image_recto)) continue
        const k = norm(c.nom || '')
        byPlayer.set(k, [...(byPlayer.get(k) || []), c])
      }
      for (const e of entries) {
        const cands = byPlayer.get(norm(e.player_name)) || []
        // une carte dont le numéro est confirmé passe avant une carte sans numéro
        const hits = cands.filter(c => !isHidden(e.id, c.image_recto || '') && matchesEntryExact(c, e, set))
        const hit = hits.find(c => c.card_number && e.card_number) || hits[0]
        if (hit?.image_recto) results.set(e.id, hit.image_recto)
      }
      // mémorise pour les prochains visiteurs (seulement les correspondances exactes ; ne remplace jamais une image existante)
      if (results.size > 0) {
        admin.from('card_set_entries').upsert(
          [...results.entries()].map(([id, image_url]) => ({ id, image_url })),
          { onConflict: 'id', ignoreDuplicates: true },
        ).then(() => {}) // sans attendre
      }
    }
  }

  // ─── ÉTAPE 2 : photos déjà enregistrées (entry_images), CONTRÔLÉES : la carte d'origine doit encore être exactement cette ligne ───
  const missing = entryIds.filter(id => !results.has(id) && byId.has(id))
  if (missing.length > 0) {
    const rows: { entry_id: number; image_url: string }[] = []
    for (const part of chunk(missing, 400)) {
      const { data } = await admin.from('entry_images').select('entry_id, image_url').in('entry_id', part).not('image_url', 'is', null).neq('image_url', '').limit(5000)
      rows.push(...((data || []) as typeof rows))
    }
    if (rows.length) {
      const urls = [...new Set(rows.map(r => r.image_url))]
      const cardOf = new Map<string, GalleryCard>()
      for (const part of chunk(urls, 150)) {
        const { data } = await admin.from('cartes_manuelles').select('nom, annee, marque, collection, collection_tag, variation, card_number, image_recto').in('image_recto', part)
        for (const c of (data || []) as GalleryCard[]) if (c.image_recto) cardOf.set(c.image_recto, c)
      }
      const okPhoto = await filterPrivate(urls)
      for (const r of rows) {
        if (results.has(r.entry_id) || isHidden(r.entry_id, r.image_url)) continue
        const c = cardOf.get(r.image_url), e = byId.get(r.entry_id)
        if (!c || !e || !okPhoto(r.image_url)) continue          // carte introuvable ou privée : on ne montre pas
        if (norm(c.nom) !== norm(e.player_name) || !matchesEntryExact(c, e, set)) continue   // pas la bonne ligne : on ne montre pas
        results.set(r.entry_id, r.image_url)
      }
    }
  }

  return NextResponse.json([...results.entries()].map(([entry_id, image_url]) => ({ entry_id, image_url })))
}
