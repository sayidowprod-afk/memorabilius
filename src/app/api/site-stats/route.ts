import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Alimente le compteur "en direct" de la page d'accueil (voir HomeHero.tsx,
// polling client toutes les ~20s) -- mêmes requêtes que le rendu serveur de
// la home, exposées ici pour un polling client léger. Cache côté CDN : avec
// potentiellement des centaines de visiteurs qui pollent toutes les ~20s,
// sans cache chaque visiteur redéclenche les mêmes agrégations Supabase.
// 60s (pas 15s) : une regeneration ISR a un coup, et personne ne remarque un
// compteur "en direct" qui bouge toutes les minutes plutot que toutes les 15s
// -- coute 4x moins cher en écritures ISR pour un gain visuel nul.
export const revalidate = 60

export async function GET() {
  const [profilesRes, totalCartesRes, bindersRes, tradeRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.rpc('get_total_cards'),
    supabase.from('binders').select('*', { count: 'exact', head: true }).neq('is_public', false).gte('page_count', 1),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true),
  ])

  // Un hoquet Supabase passager ne doit jamais renvoyer "0" comme si c'etait
  // un vrai chiffre -- le client (HomeHero.tsx) ignore deja une reponse non-OK
  // et garde le dernier nombre affiche, mais ca ne marche que si on renvoie
  // vraiment une erreur ici plutot que 200 avec des zeros. Pas de Cache-Control
  // sur l'erreur : le prochain poll (20s) doit pouvoir retenter tout de suite,
  // pas rester bloque sur une reponse en erreur mise en cache par le CDN.
  if (profilesRes.error || totalCartesRes.error || bindersRes.error || tradeRes.error) {
    return NextResponse.json({ error: 'stats indisponibles' }, { status: 503 })
  }

  const total = profilesRes.count ?? 0
  const totalCartes = totalCartesRes.data ?? 0
  const totalBinders = bindersRes.count ?? 0
  const totalTrade = tradeRes.count ?? 0

  return NextResponse.json(
    { total, totalCartes, totalBinders, totalTrade },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
  )
}
