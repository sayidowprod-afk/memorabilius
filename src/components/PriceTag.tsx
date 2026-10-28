'use client'
import { useState } from 'react'

// Étiquette de prix verticale « à couture », suspendue par une ficelle au haut de la carte (styles : .price-tag dans da.css).
// Sur ordinateur, elle se balance quand on passe la souris dessus : l'animation est jouée en entier une fois lancée
// (pilotée par une classe, pas par :hover -- le curseur se retrouve hors de l'étiquette dès qu'elle bouge).
export default function PriceTag({ price, title }: { price: number; title?: string }) {
  const [play, setPlay] = useState(false)
  const eur = Math.floor(price)
  const cts = Math.round((price - eur) * 100)
  return (
    <span
      className={`price-tag${play ? ' pt-play' : ''}`}
      title={title}
      onMouseEnter={() => setPlay(true)}
      onAnimationEnd={() => setPlay(false)}
    >
      <span className="pt-string" />
      <span className="pt-body">
        <span className="pt-hole" />
        <span className="pt-eur">{eur}</span>
        {cts > 0 && <span className="pt-cts">,{String(cts).padStart(2, '0')}</span>}
        <span className="pt-cur">€</span>
      </span>
    </span>
  )
}
