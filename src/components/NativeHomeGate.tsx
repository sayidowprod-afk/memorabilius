'use client'
import { ReactNode } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useIsNative } from '@/lib/useIsNative'
import NativeHomeDashboard from '@/components/NativeHomeDashboard'

interface SiteStats { total: number; totalCartes: number; totalBinders: number; totalTrade: number }

// L'app native chargeait jusqu'ici le même hero marketing/SEO (gros titre animé,
// CTA "s'inscrire") qu'un visiteur web anonyme, même une fois connecté. Seul le
// hero est remplacé ici — Pépites et Podium restent affichés dans les deux cas,
// ce sont de vrais points forts (activité de la communauté), pas du remplissage
// marketing. Bascule client-side (natif/auth ne sont connus qu'après hydratation) :
// un flash bref du hero est visible le temps que useAuth résolve.
export default function NativeHomeGate({ hero, siteStats }: { hero: ReactNode; siteStats: SiteStats }) {
  const isNative = useIsNative()
  const { user, loading } = useAuth()

  if (isNative && !loading && user) return <NativeHomeDashboard siteStats={siteStats} />
  return <>{hero}</>
}
