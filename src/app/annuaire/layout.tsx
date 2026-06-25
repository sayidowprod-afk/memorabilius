import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Annuaire des collectionneurs',
  description: 'Découvrez les collectionneurs de cartes NBA sur Memorabilius. Explorez leurs galeries, comparez vos collections et connectez-vous avec la communauté.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
