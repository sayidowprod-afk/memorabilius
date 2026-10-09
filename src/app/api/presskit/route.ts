import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generatePresskit, resolveLang } from '@/lib/presskit/generate'

export const runtime = 'nodejs'
export const maxDuration = 30
// Les chiffres sont recalcules a chaque telechargement, mais une copie reste en cache 10 min cote CDN.
export const dynamic = 'force-dynamic'

// Chiffres PUBLICS : memes sources que la page d'accueil (le compte de demonstration est exclu).
async function publicStats() {
  const [{ count: collectors }, { data: cards }, { count: binders }, { count: trade }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_demo', false),
    supabase.rpc('get_total_cards'),
    supabase.from('binders').select('*', { count: 'exact', head: true }).neq('is_public', false).gte('page_count', 1),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true),
  ])
  return { collectors: collectors ?? 0, cards: Number(cards ?? 0), binders: binders ?? 0, trade: trade ?? 0 }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const lang = resolveLang(url.searchParams.get('lang'), req.headers.get('accept-language'))
  try {
    const stats = await publicStats()
    const bytes = await generatePresskit({ origin: url.origin, lang, stats })
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Memorabilius-Presskit-${lang}.pdf"`,
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    })
  } catch (e: any) {
    console.error('[presskit]', e)
    return new Response('Presskit indisponible : ' + (e?.message || 'erreur'), { status: 500 })
  }
}
