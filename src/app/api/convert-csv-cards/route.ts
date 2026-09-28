import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { fetchExternalImage, extFromContentType } from '@/lib/safeFetchImage'

export const maxDuration = 60

// Convertit toutes les cartes du Google Sheet (lien_csv) d'un profil en vraies
// lignes cartes_manuelles, puis vide lien_csv -- evite que les memes cartes
// apparaissent ensuite en double partout ou les cartes CSV sont affichees
// (fiches joueurs, pages equipe/joueur, bot Discord...), puisqu'elles
// existeraient alors a la fois comme carte CSV virtuelle et comme carte reelle.
// Reservee au proprietaire du profil (verifie via le token, comme /api/update-stats).
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REHOST_CONCURRENCY = 6

// Insertion faite avec les URLs CSV d'origine (rapide, pour repondre vite meme
// avec des milliers de cartes) -- ce job en arriere-plan (waitUntil) retelecharge
// chaque image et la reheberge sur notre storage (bucket 'avatars', meme
// convention que l'ajout manuel de carte), sans recompression (qualite
// originale, comme partout ailleurs sur le site -- voir Viewer3D). Les URLs
// identiques (meme photo utilisee sur plusieurs lignes) ne sont retelechargees
// qu'une fois.
async function rehostConvertedImages(userId: string, rows: { id: string; image_recto: string; image_verso: string | null }[]) {
  const urls = new Set<string>()
  for (const r of rows) {
    if (r.image_recto) urls.add(r.image_recto)
    if (r.image_verso) urls.add(r.image_verso)
  }

  const resolved = new Map<string, string>()
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()!
      const img = await fetchExternalImage(url)
      if (!img) continue
      const ext = extFromContentType(img.contentType)
      const path = `cartes/${userId}/csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await admin.storage.from('avatars').upload(path, img.buffer, { contentType: img.contentType, upsert: true })
      if (error) continue
      const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
      resolved.set(url, pub.publicUrl)
    }
  }
  await Promise.all(Array.from({ length: REHOST_CONCURRENCY }, worker))

  for (const r of rows) {
    const newRecto = resolved.get(r.image_recto)
    if (!newRecto) continue // echec de telechargement/upload -- on garde l'URL CSV d'origine, carte toujours affichable
    const patch: Record<string, string> = { image_recto: newRecto, image_recto_hd: newRecto }
    if (r.image_verso) {
      const newVerso = resolved.get(r.image_verso)
      if (newVerso) { patch.image_verso = newVerso; patch.image_verso_hd = newVerso }
    }
    try { await admin.from('cartes_manuelles').update(patch).eq('id', r.id) } catch { /* meilleur effort */ }
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin.from('profiles')
    .select('id, display_name, avatar_url, lien_csv, couleur_bordure').eq('id', user.id).single()
  if (!profile?.lien_csv) return NextResponse.json({ error: 'Aucun lien CSV sur ce profil.' }, { status: 400 })

  const csvCards = await fetchCsvCardsForProfiles([profile])
  if (!csvCards.length) return NextResponse.json({ error: 'Le Google Sheet est vide ou inaccessible.' }, { status: 400 })

  // Deja converties (relance apres un echec partiel, ou carte deja ajoutee a la
  // main entre-temps) : ecartees par cle stable image_recto -- une carte CSV
  // sans image (rejetee par fetchCsvCardsForProfiles) n'a de toute facon jamais
  // pu etre importee, donc rien a comparer d'autre.
  const { data: existing } = await admin.from('cartes_manuelles').select('image_recto').eq('user_id', user.id)
  const existingImgs = new Set((existing || []).map(e => e.image_recto))

  const toInsert = csvCards
    .filter(c => c.img && !existingImgs.has(c.img))
    .map(c => ({
      user_id: user.id,
      nom: c.name || 'Carte',
      equipe: c.team || null,
      annee: c.year || null,
      marque: c.brand || null,
      collection: c.serie || null,
      variation: c.variant || null,
      num: c.num || null,
      rc: c.rc, auto: c.auto, patch: c.patch,
      // Pas d'info d'orientation dans le CSV -- portrait par defaut (grande
      // majorite des cartes de sport), corrigeable a la main ensuite comme
      // n'importe quelle carte.
      is_horizontal: false, format: 'standard',
      // URLs CSV d'origine (ibb ou autre) -- rehebergees sur notre storage juste
      // apres, en arriere-plan (voir rehostConvertedImages).
      image_recto: c.img,
      image_verso: c.back || null,
      image_recto_hd: c.img,
      image_verso_hd: c.back || null,
    }))

  const insertedRows: { id: string; image_recto: string; image_verso: string | null }[] = []
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { data, error } = await admin.from('cartes_manuelles').insert(batch).select('id, image_recto, image_verso')
    if (error) return NextResponse.json({ error: error.message, inserted: insertedRows.length }, { status: 500 })
    insertedRows.push(...(data || []))
  }

  const originalCsv = profile.lien_csv
  await admin.from('profiles').update({ lien_csv: '' }).eq('id', user.id)

  // Trace pour permettre un revert (voir /api/convert-csv-cards/revert) : quoi
  // exactement a ete cree par CETTE conversion, et quel lien_csv restaurer.
  let conversionId: string | null = null
  if (insertedRows.length) {
    const { data: conv } = await admin.from('csv_conversions')
      .insert({ user_id: user.id, lien_csv: originalCsv, card_ids: insertedRows.map(r => r.id) })
      .select('id').single()
    conversionId = conv?.id ?? null

    waitUntil(rehostConvertedImages(user.id, insertedRows).catch(e => console.error('[convert-csv-cards] rehost echec:', e)))
  }

  return NextResponse.json({
    ok: true,
    total: csvCards.length,
    inserted: insertedRows.length,
    skipped: csvCards.length - toInsert.length,
    conversionId,
  })
}
