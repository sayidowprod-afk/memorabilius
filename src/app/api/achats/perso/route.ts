import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'

export const maxDuration = 20

const money = (v: unknown): number | null | undefined => {
  if (v === null || v === '') return null
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n < 1000000 ? Math.round(n * 100) / 100 : undefined
}
const cleanTags = (v: unknown): string[] => (Array.isArray(v) ? v : [])
  .filter((t): t is string => typeof t === 'string')
  .map(t => t.trim().replace(/^#/, '').toLowerCase().slice(0, 24)).filter(Boolean)
  .filter((t, i, a) => a.indexOf(t) === i).slice(0, 12)

// Données personnelles d'un achat ou d'une enchère (notes, étiquettes, valeur estimée, limite, seuil d'alerte, numéro de
// suivi, « reçu »). Les membres n'écrivent pas directement dans la table : tout est revalidé ici, et seules leurs lignes sont touchées.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const b = await req.json().catch(() => null) as { ids?: unknown; patch?: Record<string, unknown>; addTags?: unknown } | null
  const ids = (Array.isArray(b?.ids) ? b!.ids : []).filter((x): x is string => typeof x === 'string').slice(0, 200)
  if (!ids.length) return NextResponse.json({ error: 'Aucun achat.' }, { status: 400 })
  const p = b?.patch || {}

  const upd: Record<string, unknown> = {}
  if ('notes' in p) upd.notes = typeof p.notes === 'string' ? p.notes.trim().slice(0, 1000) || null : null
  if ('tags' in p) upd.tags = cleanTags(p.tags)
  if ('suivi_numero' in p) upd.suivi_numero = typeof p.suivi_numero === 'string' ? p.suivi_numero.replace(/\s+/g, '').slice(0, 60) || null : null
  if ('transporteur' in p) upd.transporteur = typeof p.transporteur === 'string' ? p.transporteur.trim().slice(0, 40) || null : null
  for (const k of ['valeur_estimee', 'limite_perso', 'seuil_alerte'] as const) {
    if (!(k in p)) continue
    const v = money(p[k])
    if (v === undefined) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
    upd[k] = v
    if (k === 'limite_perso') upd.alerte_limite_envoyee = false
    if (k === 'seuil_alerte') upd.alerte_seuil_envoyee = false
  }
  if ('recu' in p) upd.recu_at = p.recu ? new Date().toISOString() : null

  // ajout d'étiquettes à plusieurs achats d'un coup (actions groupées) : on fusionne avec celles déjà présentes
  const addTags = cleanTags(b?.addTags)
  if (!Object.keys(upd).length && !addTags.length) return NextResponse.json({ error: 'Rien à enregistrer.' }, { status: 400 })

  if (addTags.length) {
    const { data, error } = await supabaseAdmin.from('achats_membre').select('id, tags').eq('user_id', user.id).in('id', ids)
    if (error) return NextResponse.json({ error: /tags/.test(error.message) ? 'Migration 20261104 à appliquer dans Supabase.' : error.message }, { status: 500 })
    for (const r of data || []) {
      const merged = cleanTags([...(r.tags || []), ...addTags])
      const { error: e2 } = await supabaseAdmin.from('achats_membre').update({ ...upd, tags: merged }).eq('user_id', user.id).eq('id', r.id)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin.from('achats_membre').update(upd).eq('user_id', user.id).in('id', ids)
  if (error) return NextResponse.json({ error: /column|schema cache/.test(error.message) ? 'Migration 20261104 à appliquer dans Supabase.' : error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
