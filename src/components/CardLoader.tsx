'use client'

// Indicateur de chargement : trois cartes qui se retournent a tour de role (remplace les ronds qui tournent).
export default function CardLoader({ label }: { label?: string }) {
  return (
    <div className="cf-loader" role="status" aria-label={label || 'Chargement'}>
      <i /><i /><i />
    </div>
  )
}
