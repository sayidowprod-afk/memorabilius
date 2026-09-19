'use client'
import { usePathname } from 'next/navigation'
import Navbar from './NavBar'
import Footer from './Footer'
import ChatBubble from './ChatBubble'
import Toaster from './Toaster'
import OnboardingTooltip from './OnboardingTooltip'
import WebOnly from './WebOnly'
import MobileTopBar from './MobileTopBar'
import MobileBottomNav from './MobileBottomNav'
import PageTransition from './PageTransition'
import InstallBanner from './InstallBanner'
import DemoAttractMode from './DemoAttractMode'

// Le quiz en direct (page spectateur + overlay OBS/Streamlabs, /quiz/[code]*)
// a besoin d'un rendu plein écran SANS le chrome habituel du site (navbar,
// footer, marges du <main>) -- l'overlay doit rester transparent pour être
// composé par-dessus le flux vidéo dans OBS, et navbar/footer par-dessus
// casseraient totalement ce rendu (contrairement au presenter admin existant,
// qui peut se contenter de les recouvrir en position:fixed puisqu'il est
// opaque).
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname?.startsWith('/quiz/')

  if (bare) return <>{children}</>

  return (
    <>
      <WebOnly><Navbar /></WebOnly>
      <MobileTopBar />
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>
        <PageTransition>{children}</PageTransition>
      </main>
      <WebOnly><Footer /></WebOnly>
      <ChatBubble />
      <Toaster />
      <OnboardingTooltip />
      <WebOnly><InstallBanner /></WebOnly>
      <MobileBottomNav />
      <DemoAttractMode />
    </>
  )
}
