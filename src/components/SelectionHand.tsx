'use client'

// "Main" de cartes : les cartes cochees se rangent en eventail dans la barre de selection (elles depassent vers le haut).
export default function SelectionHand({ images }: { images: string[] }) {
  if (!images.length) return null
  const m = (images.length - 1) / 2
  return (
    <div className="shand" aria-hidden>
      {images.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${k}-${src}`} src={src} alt=""
          style={{ left: `calc(50% - 22px + ${(k - m) * 20}px)`, transform: `rotate(${(k - m) * 8}deg)`, zIndex: k }} />
      ))}
    </div>
  )
}
