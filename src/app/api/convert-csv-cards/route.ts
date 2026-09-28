import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'

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
      image_recto: c.img,
      image_verso: c.back || null,
      image_recto_hd: c.img,
      image_verso_hd: c.back || null,
    }))

  const insertedIds: string[] = []
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { data, error } = await admin.from('cartes_manuelles').insert(batch).select('id')
    if (error) return NextResponse.json({ error: error.message, inserted: insertedIds.length }, { status: 500 })
    insertedIds.push(...(data || []).map(d => d.id))
  }

  const originalCsv = profile.lien_csv
  await admin.from('profiles').update({ lien_csv: '' }).eq('id', user.id)

  // Trace pour permettre un revert (voir /api/convert-csv-cards/revert) : quoi
  // exactement a ete cree par CETTE conversion, et quel lien_csv restaurer.
  let conversionId: string | null = null
  if (insertedIds.length) {
    const { data: conv } = await admin.from('csv_conversions')
      .insert({ user_id: user.id, lien_csv: originalCsv, card_ids: insertedIds })
      .select('id').single()
    conversionId = conv?.id ?? null
  }

  return NextResponse.json({
    ok: true,
    total: csvCards.length,
    inserted: insertedIds.length,
    skipped: csvCards.length - toInsert.length,
    conversionId,
  })
}
