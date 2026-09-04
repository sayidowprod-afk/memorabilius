import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Alimente le compteur "en direct" de la page d'accueil (voir LiveStat.tsx) --
// mêmes requêtes que le rendu serveur de la home, exposées ici pour un
// polling client léger. Cache court côté CDN : avec potentiellement des
// centaines de visiteurs qui pollent toutes les ~20s, sans cache chaque
// visiteur redéclenche les mêmes agrégations Supabase.
export const revalidate = 15

export async function GET() {
  const [
    { count },
    { data: statsData },
    { count: bindersCount },
    { count: tradeCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('stats_total').gt('stats_total', 0),
    supabase.from('binders').select('*', { count: 'exact', head: true }).neq('is_public', false).gte('page_count', 1),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true),
  ])

  const total = count ?? 0
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0
  const totalBinders = bindersCount ?? 0
  const totalTrade = tradeCount ?? 0

  return NextResponse.json(
    { total, totalCartes, totalBinders, totalTrade },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
  )
}
