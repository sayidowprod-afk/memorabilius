import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un compte',
  description: 'Inscrivez-vous gratuitement sur Memorabilius et commencez à gérer votre collection de cartes NBA en 3D.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
