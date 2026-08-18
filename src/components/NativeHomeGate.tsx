'use client'
import { ReactNode } from 'react'
import { useAuth } from '@/lib/AuthContext'
import NativeHomeDashboard from '@/components/NativeHomeDashboard'

interface SiteStats { total: number; totalCartes: number; totalBinders: number; totalTrade: number }

// Le hero marketing/SEO (gros titre animé, CTA "s'inscrire") ne sert que les
// visiteurs non connectés — un collectionneur déjà inscrit voit sa galerie,
// peu importe la plateforme (app native, PWA, navigateur desktop) : le
// dashboard n'utilise aucune API Capacitor, rien ne le limite au natif.
// Pépites et Podium restent affichés dans les deux cas, ce sont de vrais
// points forts (activité de la communauté), pas du remplissage marketing.
// Bascule client-side (l'auth n'est connue qu'après hydratation) : un flash
// bref du hero est visible le temps que useAuth résolve.
export default function NativeHomeGate({ hero, siteStats }: { hero: ReactNode; siteStats: SiteStats }) {
  const { user, loading } = useAuth()

  if (!loading && user) return <NativeHomeDashboard siteStats={siteStats} />
  return <>{hero}</>
}
