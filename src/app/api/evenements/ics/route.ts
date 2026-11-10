import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'
import { buildEventICS } from '@/lib/eventIcs'

// Fichier d'agenda (.ics) d'UN événement, servi depuis une vraie adresse : sur iPhone, Safari propose directement de l'ajouter à l'agenda
// (un fichier créé en mémoire par la page, lui, ne fait rien sur téléphone).
export async function GET(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return new Response('Événement introuvable.', { status: 404 })
  const { data: ev } = await createServerClient().from('events')
    .select('id, title, description, date, time, end_date, city, country, location_name').eq('id', id).maybeSingle()
  if (!ev) return new Response('Événement introuvable.', { status: 404 })
  const name = (ev.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) || 'evenement') + '.ics'
  return new Response(buildEventICS(ev), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
