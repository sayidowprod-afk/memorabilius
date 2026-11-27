import type { Metadata } from 'next'
import JoueurMystere from '@/components/JoueurMystere'

export const metadata: Metadata = {
  title: 'Joueur mystère NBA | Memorabilius',
  description: 'Trouve chaque jour le joueur NBA mystère en 8 essais : équipe, poste, taille, âge, numéro et pays sont comparés à chaque proposition.',
  alternates: { canonical: 'https://www.memorabilius.fr/jeu-joueur' },
}

export default function JeuJoueurPage() {
  return (
    <main style={{ background: '#0d1840', minHeight: '70vh' }}>
      <JoueurMystere />
    </main>
  )
}
