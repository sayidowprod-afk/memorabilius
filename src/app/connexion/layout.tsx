import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre compte Memorabilius pour gérer votre collection de cartes NBA.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
