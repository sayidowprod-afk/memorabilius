'use client'
import { ReactNode } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useIsNative } from '@/lib/useIsNative'
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
  const isNative = useIsNative()

  if (!loading && user) return <NativeHomeDashboard siteStats={siteStats} />

  // Sur l'app, la résolution de l'auth au cold start peut prendre plusieurs
  // secondes (voir AuthContext.tsx) -- largement au-delà d'un "flash bref".
  // Basculer sur le hero public pendant ce temps donne l'impression d'être
  // déconnecté (carrousel seul, pas de panel) : mieux vaut un simple
  // indicateur de chargement le temps que loading passe à false.
  if (isNative && loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #ccc', borderTopColor: '#003DA6', borderRadius: '50%', animation: 'nativeHomeSpin 0.8s linear infinite' }} />
        <style>{`@keyframes nativeHomeSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return <>{hero}</>
}
