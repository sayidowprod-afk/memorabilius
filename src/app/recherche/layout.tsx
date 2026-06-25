import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recherche de cartes',
  description: 'Recherchez des cartes NBA dans les galeries de tous les collectionneurs Memorabilius. Trouvez par joueur, équipe, marque ou variation.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
