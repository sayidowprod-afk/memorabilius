import type { Metadata, Viewport } from 'next'
import './globals.css'
import './da.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { LangProvider } from '@/lib/LangContext'
import { AuthProvider } from '@/lib/AuthContext'
import { NativeProvider } from '@/lib/useIsNative'
import TrackView from '@/components/TrackView'
import NativeInit from '@/components/NativeInit'
import OfflinePrepare from '@/components/OfflinePrepare'
import HoloLight from '@/components/HoloLight'
import PullToRefresh from '@/components/PullToRefresh'
import PushInit from '@/components/PushInit'
import OfflineBanner from '@/components/OfflineBanner'
import LocalRemindersInit from '@/components/LocalRemindersInit'
import ChunkErrorReload from '@/components/ChunkErrorReload'
import HangWatchdog from '@/components/HangWatchdog'
import SiteShell from '@/components/SiteShell'
import ConfirmHost from '@/components/ConfirmHost'
import CommandPalette from '@/components/CommandPalette'
import NewsPopup from '@/components/NewsPopup'

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
  alternates: {
    types: { 'application/rss+xml': '/rss.xml' },
  },
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
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')!=='light'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')};try{var a=localStorage.getItem('mb_accent');if(a&&/^#[0-9a-f]{6}$/i.test(a)){document.documentElement.style.setProperty('--accent',a);document.documentElement.setAttribute('data-accent','1')}}catch(e){};try{var h=document.documentElement,q=new URLSearchParams(location.search).get('season'),d=new Date(),m=d.getMonth()+1,j=d.getDate(),z=null;if(m===12&&j<=26)z='noel';else if(m===2&&j<=20)z='allstar';else if((m===4&&j>=15)||m===5||(m===6&&j<=20))z='playoffs';if(q==='noel'||q==='allstar'||q==='playoffs')z=q;else if(localStorage.getItem('mb_season_off')==='1')z=null;if(z){h.setAttribute('data-season',z);if(!h.hasAttribute('data-accent')){h.style.setProperty('--accent',{noel:'#1f9d55',allstar:'#c47f00',playoffs:'#c0262d'}[z]);h.setAttribute('data-accent','1')}}}catch(e){}` }} />
        {/* Filet de secours "page blanche/bloquée" (voir HangWatchdog.tsx) : tourne
            avant même l'hydratation React, donc capte aussi un blocage qui empêche
            React de démarrer du tout, pas seulement un hang après coup. */}
        <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){try{if(!window.__memAppMounted){var k='hang-reload-at';var last=Number(sessionStorage.getItem(k)||0);if(Date.now()-last>30000){sessionStorage.setItem(k,String(Date.now()));location.reload()}}}catch(e){}},9000)` }} />
        <NativeProvider>
        <AuthProvider>
        <ThemeProvider>
          <LangProvider>
            <ChunkErrorReload />
            <HangWatchdog />
            <NativeInit />
            <HoloLight />
            <PushInit />
            <LocalRemindersInit />
            <OfflineBanner />
            <OfflinePrepare />
            <PullToRefresh />
            <ConfirmHost />
            <CommandPalette />
            <NewsPopup />
            <SiteShell>{children}</SiteShell>
          </LangProvider>
        </ThemeProvider>
        </AuthProvider>
        </NativeProvider>
        <TrackView />
      </body>
    </html>
  )
}
