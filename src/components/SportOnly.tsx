'use client'
// Masque ses enfants (pépites, podiums de sport) pour les membres qui ne collectionnent que des cartes à jouer.
import { useCollectionFocus } from '@/lib/useCollectionFocus'

export default function SportOnly({ children }: { children: React.ReactNode }) {
  return useCollectionFocus() === 'tcg' ? null : <>{children}</>
}
