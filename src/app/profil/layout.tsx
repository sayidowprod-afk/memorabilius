import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mon profil',
  description: 'Gérez votre compte Memorabilius : photo de profil, mot de passe, statistiques de collection.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
