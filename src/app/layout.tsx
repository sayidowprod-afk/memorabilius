import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/NavBar'
import Footer from '@/components/Footer'
import ChatBubble from '@/components/ChatBubble'
import Toaster from '@/components/Toaster'
import OnboardingTooltip from '@/components/OnboardingTooltip'
import { ThemeProvider } from '@/lib/ThemeContext'
import { LangProvider } from '@/lib/LangContext'
import { AuthProvider } from '@/lib/AuthContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import TrackView from '@/components/TrackView'
import InstallBanner from '@/components/InstallBanner'
import WebOnly from '@/components/WebOnly'
import MobileTopBar from '@/components/MobileTopBar'
import MobileBottomNav from '@/components/MobileBottomNav'
import NativeInit from '@/components/NativeInit'
import PageTransition from '@/components/PageTransition'
import PullToRefresh from '@/components/PullToRefresh'
import PushInit from '@/components/PushInit'
import OfflineBanner from '@/components/OfflineBanner'
import LocalRemindersInit from '@/components/LocalRemindersInit'
import ChunkErrorReload from '@/components/ChunkErrorReload'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#003DA6',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Memorabilius — La plateforme des collectionneurs de cartes',
    template: '%s | Memorabilius',
  },
  description: 'Gérez et partagez votre collection de cartes de sport en 3D. Galeries interactives, annuaire des collectionneurs, trades et teams.',
  keywords: ['cartes de sport', 'collection', 'NBA', 'galerie 3D', 'trade', 'collectionneurs', 'panini', 'prizm'],
  authors: [{ name: 'Memorabilius' }],
  creator: 'Memorabilius',
  metadataBase: new URL('https://www.memorabilius.fr'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Memorabilius',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://www.memorabilius.fr',
    siteName: 'Memorabilius',
    title: 'Memorabilius — La plateforme des collectionneurs de cartes',
    description: 'Gérez et partagez votre collection de cartes de sport en 3D.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Memorabilius' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Memorabilius — La plateforme des collectionneurs de cartes',
    description: 'Gérez et partagez votre collection de cartes de sport en 3D.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  other: {
    'google': 'notranslate',
    'privacy-policy': 'https://www.memorabilius.fr/confidentialite',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    <html lang="fr" suppressHydrationWarning>
      {supabaseOrigin && (
        <head>
          {/* Quasiment toutes les données de l'app viennent de Supabase — établir
              la connexion (DNS + TLS) pendant que la page charge évite d'attendre
              ce round-trip au moment du tout premier fetch. */}
          <link rel="preconnect" href={supabaseOrigin} />
          <link rel="dns-prefetch" href={supabaseOrigin} />
        </head>
      )}
      <body>
        {/* Lit le thème depuis localStorage AVANT le premier rendu React pour éviter le flash light→dark (CLS) */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}` }} />
        <AuthProvider>
        <ThemeProvider>
          <LangProvider>
            <ChunkErrorReload />
            <NativeInit />
            <PushInit />
            <LocalRemindersInit />
            <OfflineBanner />
            <PullToRefresh />
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
          </LangProvider>
        </ThemeProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
        <TrackView />
      </body>
    </html>
  )
}
