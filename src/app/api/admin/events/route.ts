import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()

// Champs d'un événement ; les champs vides ('' envoyés par les formulaires) deviennent null : une heure ou une date vide envoyée en texte faisait refuser l'ajout par la base, sans message.
const FIELDS = ['title', 'description', 'date', 'time', 'end_date', 'city', 'country', 'location_name', 'website', 'image_url'] as const
function clean(e: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) if (k in e) { const v = e[k]; out[k] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : (v ?? null) }
  return out
}

// POST { action: 'create', event } | { action: 'update', id, event } | { action: 'delete', id }
// Passe par la clé de service : la suppression des participants d'un événement était bloquée par la sécurité de la base (chacun ne peut supprimer que sa propre inscription), d'où l'erreur de clé étrangère.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  if (b.action === 'create') {
    const ev = clean(b.event || {})
    if (!ev.title || !ev.date || !ev.city) return NextResponse.json({ error: 'Nom, date et ville obligatoires' }, { status: 400 })
    if (!ev.country) ev.country = 'France'
    const { data, error } = await admin.from('events').insert(ev).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data?.id })
  }
  if (b.action === 'update') {
    const id = Number(b.id); if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    const ev = clean(b.event || {})
    if (!ev.title || !ev.date || !ev.city) return NextResponse.json({ error: 'Nom, date et ville obligatoires' }, { status: 400 })
    const { error } = await admin.from('events').update(ev).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'delete') {
    const id = Number(b.id); if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    const { error: e1 } = await admin.from('event_attendees').delete().eq('event_id', id)
    if (e1) return NextResponse.json({ error: 'participants : ' + e1.message }, { status: 500 })
    const { error: e2 } = await admin.from('events').delete().eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
