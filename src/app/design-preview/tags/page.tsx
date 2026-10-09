import type { Metadata } from 'next'
import TagsCompare from './TagsCompare'

// Page de travail : comparaison de styles d'icones RC / AUTO / PATCH / NUM.
// Non indexee, rien d'ecrit ni de lu cote donnees (cartes d'exemple en dur).
export const metadata: Metadata = {
  title: 'Comparaison icônes',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <TagsCompare />
}
