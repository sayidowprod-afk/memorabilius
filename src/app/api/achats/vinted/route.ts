import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'
import { extractVintedUrl } from '@/lib/vinted'

export const maxDuration = 30

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null
}

// Enregistre un achat Vinted (saisi ou prérempli, vérifié par le membre). Les membres n'écrivent pas directement dans la
// table : tout est revalidé ici.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const titre = typeof b?.titre === 'string' ? b.titre.trim().slice(0, 200) : ''
  if (!titre) return NextResponse.json({ error: 'Le titre est obligatoire.' }, { status: 400 })

  const photo = typeof b?.photo_url === 'string' ? b.photo_url : ''
  const photoOk = /^https:\/\/images\d*\.vinted\.net\//.test(photo) || (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) && photo.length < 80000)
  const dateIn = typeof b?.achete_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.achete_at) ? b.achete_at : new Date().toISOString().slice(0, 10)
  const achete = new Date(dateIn + 'T12:00:00Z').toISOString()
  const prix = money(b?.prix), port = money(b?.frais_port), frais = money(b?.autres_frais)
  const total = money(b?.total_paye) ?? (prix !== null ? Math.round((prix + (port || 0) + (frais || 0)) * 100) / 100 : null)
  const devise = typeof b?.devise === 'string' && /^[A-Z]{3}$/.test(b.devise) ? b.devise : 'EUR'

  const row = {
    user_id: user.id, source: 'vinted', type: 'achat', ref: 'v-' + randomUUID(),
    titre, photo_url: photoOk ? photo : null, photo_mini: photoOk ? photo : null,
    vendeur: typeof b?.vendeur === 'string' ? b.vendeur.trim().slice(0, 80) || null : null,
    devise, prix, frais_port: port, autres_frais: frais, total_paye: total,
    achete_at: achete, paye_at: achete, expedie_at: b?.expedie ? new Date().toISOString() : null,
    lien: extractVintedUrl(typeof b?.lien === 'string' ? b.lien : '') || null,
    updated_at: new Date().toISOString(),
  }
  let { error } = await supabaseAdmin.from('achats_membre').insert(row)
  // migration 20261102_ebay_achats_frais.sql pas encore appliquée : on enregistre sans les colonnes de totaux
  if (error && /total_paye|autres_frais/.test(error.message)) {
    const { total_paye: _t, autres_frais: _a, ...rest } = row
    ;({ error } = await supabaseAdmin.from('achats_membre').insert(rest))
  }
  if (error) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 400 })
  await supabaseAdmin.from('achats_membre').delete().eq('id', b.id).eq('user_id', user.id).eq('source', 'vinted')
  return NextResponse.json({ ok: true })
}
