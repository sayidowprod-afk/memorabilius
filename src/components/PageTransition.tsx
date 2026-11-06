'use client'
import { ViewTransition } from 'react'
import { usePathname } from 'next/navigation'

// Changement de page : transition de vue du navigateur (fondu court, voir da.css « 248 »), via <ViewTransition> de React.
// Repli : navigateurs sans cette API gardent le fondu CSS ci-dessous ; l'API est désactivée par da.css (@supports) là où elle existe.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <ViewTransition>
        <div key={pathname} className="page-transition">
          {children}
        </div>
      </ViewTransition>
      <style>{`
        /* opacity-only: un transform ici, meme temporaire pendant l'anim,
           deviendrait le containing block des enfants position:fixed (ex: Viewer3D)
           et les ferait s'afficher hors-viewport au lieu de plein ecran. */
        .page-transition { animation: page-in 0.22s ease-out; }
        @keyframes page-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-transition { animation: none; }
        }
      `}</style>
    </>
  )
}
