import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'

export const maxDuration = 20

// undefined = invalide, null = vide, nombre = valeur
const money = (v: unknown): number | null | undefined => {
  if (v === null || v === '') return null
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n < 1000000 ? Math.round(n * 100) / 100 : undefined
}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const dbError = (m: string) => (/ventes_membre|schema cache|column/.test(m) ? 'Migration 20261105 à appliquer dans Supabase.' : 'Enregistrement impossible.')

// Saisie d'une vente à la main (Vinted, salon, échange…).
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const titre = str(b?.titre, 200)
  if (!titre) return NextResponse.json({ error: 'Le titre est obligatoire.' }, { status: 400 })
  const prix = money(b?.prix)
  if (prix === undefined || prix === null) return NextResponse.json({ error: 'Indique le prix de vente.' }, { status: 400 })
  const port = money(b?.port_facture), frais = money(b?.frais), coutPort = money(b?.cout_port), coutAchat = money(b?.cout_achat)
  if ([port, frais, coutPort, coutAchat].some(v => v === undefined)) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
  const date = isDay(b?.vendu_at) ? b.vendu_at : new Date().toISOString().slice(0, 10)
  const source = b?.source === 'vinted' ? 'vinted' : 'autre'
  const total = money(b?.total_encaisse) ?? Math.round((prix + (port || 0)) * 100) / 100
  const row = {
    user_id: user.id, source, ref: 'm-' + randomUUID(), titre, acheteur: str(b?.acheteur, 80),
    devise: 'EUR', prix, port_facture: port, total_encaisse: total, frais, cout_port: coutPort, cout_achat: coutAchat,
    notes: str(b?.notes, 500), vendu_at: new Date(date + 'T12:00:00Z').toISOString(), updated_at: new Date().toISOString(),
    ...(typeof b?.achat_id === 'string' && UUID.test(b.achat_id) ? { achat_id: b.achat_id } : {}),
  }
  const { error } = await supabaseAdmin.from('ventes_membre').insert(row)
  if (error) return NextResponse.json({ error: dbError(error.message) }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Complète une vente (importée ou saisie) : frais, port réel, coût d'achat (profit réalisé), achat relié, notes.
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as { id?: string; patch?: Record<string, unknown> } | null
  if (!b?.id || !UUID.test(b.id)) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 400 })
  const p = b.patch || {}
  const upd: Record<string, unknown> = {}
  for (const k of ['frais', 'cout_port', 'cout_achat', 'port_facture'] as const) {
    if (!(k in p)) continue
    const v = money(p[k])
    if (v === undefined) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
    upd[k] = v
  }
  if ('notes' in p) upd.notes = str(p.notes, 500)
  if ('achat_id' in p) {
    if (p.achat_id === null) upd.achat_id = null
    else if (typeof p.achat_id === 'string' && UUID.test(p.achat_id)) {
      // l'achat relié doit appartenir au membre
      const { data } = await supabaseAdmin.from('achats_membre').select('id').eq('id', p.achat_id).eq('user_id', user.id).maybeSingle()
      if (!data) return NextResponse.json({ error: 'Achat introuvable.' }, { status: 400 })
      upd.achat_id = p.achat_id
    } else return NextResponse.json({ error: 'Achat invalide.' }, { status: 400 })
  }
  if (!Object.keys(upd).length) return NextResponse.json({ error: 'Rien à enregistrer.' }, { status: 400 })
  upd.updated_at = new Date().toISOString()
  const { error } = await supabaseAdmin.from('ventes_membre').update(upd).eq('id', b.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: dbError(error.message) }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Supprime une vente saisie à la main (une vente eBay réapparaîtrait à la lecture suivante).
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id || !UUID.test(b.id)) return NextResponse.json({ error: 'Vente introuvable.' }, { status: 400 })
  await supabaseAdmin.from('ventes_membre').delete().eq('id', b.id).eq('user_id', user.id).neq('source', 'ebay')
  return NextResponse.json({ ok: true })
}
