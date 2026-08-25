'use client'
import { usePathname } from 'next/navigation'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <div key={pathname} className="page-transition">
        {children}
      </div>
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
