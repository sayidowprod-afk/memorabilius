import { Suspense } from 'react'
import MesAchatsHub from '@/components/MesAchatsHub'

// Page « Mes achats » à onglets (Achats, Ventes, Gradation) : voir MesAchatsHub. Le Suspense est exigé par useSearchParams.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MesAchatsHub />
    </Suspense>
  )
}
