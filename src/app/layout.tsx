import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Memorabilius',
  description: 'La plateforme ultime pour les collectionneurs de cartes de Sports.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Navbar />
        <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
