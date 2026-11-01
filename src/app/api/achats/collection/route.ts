import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'
import { isSafeExternalUrl } from '@/lib/safeUrl'

export const maxDuration = 60

const money = (v: number | null | undefined, devise: string | null) =>
  v == null ? null : `${v.toFixed(2).replace('.', ',')} ${!devise || devise === 'EUR' ? '€' : devise}`

// Copie la photo de l'annonce sur notre stockage (elle ne disparaît plus quand l'annonce expire).
async function copyPhoto(url: string | null, uid: string, i: number): Promise<string | null> {
  if (!url) return null
  try {
    let bytes: Buffer, type = 'image/jpeg'
    if (url.startsWith('data:image/jpeg;base64,')) {
      bytes = Buffer.from(url.split(',')[1] || '', 'base64')
    } else {
      if (!isSafeExternalUrl(url)) return null
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' })
      if (!res.ok) return null
      type = res.headers.get('content-type') || 'image/jpeg'
      if (!type.startsWith('image/')) return null
      bytes = Buffer.from(await res.arrayBuffer())
    }
    if (!bytes.length || bytes.length > 8_000_000) return null
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const path = `cartes/${uid}/${Date.now()}_${i}_recto.${ext}`
    const { error } = await supabaseAdmin.storage.from('avatars').upload(path, bytes, { contentType: type, upsert: true })
    if (error) return null
    return supabaseAdmin.storage.from('avatars').getPublicUrl(path).data.publicUrl
  } catch { return null }
}

// « Ajouter à ma collection » : crée une carte (titre de l'annonce, photo copiée, prix payé en note perso) à partir d'un achat.
// Le membre complète ensuite la fiche (joueur, set, année…) depuis la galerie. Une carte n'est jamais créée deux fois pour le même achat.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as { ids?: unknown } | null
  const ids = (Array.isArray(b?.ids) ? b!.ids : []).filter((x): x is string => typeof x === 'string').slice(0, 30)
  if (!ids.length) return NextResponse.json({ error: 'Aucun achat.' }, { status: 400 })

  const { data: rows, error } = await supabaseAdmin.from('achats_membre').select('*').eq('user_id', user.id).eq('type', 'achat').in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const created: Array<{ achat_id: string; carte_id: string }> = []
  let i = 0
  for (const r of rows || []) {
    if (r.carte_id) continue
    const photo = await copyPhoto(r.photo_url || r.photo_mini, user.id, i++)
    const total = r.prix ?? null
    const date = r.achete_at ? new Date(r.achete_at).toLocaleDateString('fr-FR') : null
    const note = [`Acheté${total !== null ? ' ' + money(total, r.devise) : ''}${date ? ' le ' + date : ''} (${r.source === 'vinted' ? 'Vinted' : 'eBay'})`,
      r.frais_port ? `port ${money(r.frais_port, r.devise)}` : null, r.vendeur ? `vendeur : ${r.vendeur}` : null].filter(Boolean).join(' · ')
    const { data: carte, error: e2 } = await supabaseAdmin.from('cartes_manuelles').insert({
      user_id: user.id, nom: (r.titre || 'Carte achetée').slice(0, 200), grade: 'Raw',
      image_recto: photo, notes_perso: note, notes_perso_public: false,
    }).select('id').single()
    if (e2 || !carte) return NextResponse.json({ error: 'Création de la carte impossible.', created }, { status: 500 })
    await supabaseAdmin.from('achats_membre').update({ carte_id: String(carte.id) }).eq('user_id', user.id).eq('id', r.id)
    created.push({ achat_id: r.id, carte_id: String(carte.id) })
  }
  return NextResponse.json({ ok: true, created })
}
