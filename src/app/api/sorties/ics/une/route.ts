import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'
import { buildEventICS, releaseEvent } from '@/lib/eventIcs'

// Fichier d'agenda (.ics) d'UNE sortie de cartes, servi depuis une vraie adresse : sur iPhone, Safari propose directement de l'ajouter à l'agenda.
// (Route à part : l'agenda complet /api/sorties/ics reste mis en cache une heure.)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const date = sp.get('date') || '', name = sp.get('name') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return new Response('Sortie introuvable.', { status: 404 })
  const { data: r } = await createServerClient().from('card_releases').select('name, release_date, formats, source_url').eq('release_date', date).eq('name', name).maybeSingle()
  if (!r) return new Response('Sortie introuvable.', { status: 404 })
  return new Response(buildEventICS(releaseEvent(r)), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="sortie-cartes.ics"',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
