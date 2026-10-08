import type { Metadata } from 'next'
import DesignPreview from './DesignPreview'

// Page de travail pour valider la nouvelle direction artistique AVANT de toucher
// aux vraies pages : non liee depuis le site, non indexee, aucune donnee reelle
// ecrite ni lue (cartes d'exemple en dur).
export const metadata: Metadata = {
  title: 'Aperçu DA',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <DesignPreview />
}
