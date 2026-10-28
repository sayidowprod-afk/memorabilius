'use client'
import { useState } from 'react'

// Étiquette de prix verticale « à couture », suspendue par une ficelle au haut de la carte (styles : .price-tag dans da.css).
// Sur ordinateur, elle se balance quand on passe la souris dessus : l'animation est jouée en entier une fois lancée
// (pilotée par une classe, pas par :hover -- le curseur se retrouve hors de l'étiquette dès qu'elle bouge).
export default function PriceTag({ price, title }: { price: number; title?: string }) {
  const [play, setPlay] = useState(false)
  const eur = Math.floor(price)
  const cts = Math.round((price - eur) * 100)
  const eurText = eur.toLocaleString('fr-FR')
  // L'étiquette s'élargit avec le montant (« 1 250 », « 3 500 000 ») autour de sa ficelle : on recule le point d'accroche
  // pour qu'elle ne déborde pas du bord gauche de la carte (largeur estimée en % de la carte, chiffre ≈ 5,4 %, espace ≈ 2,4 %).
  const digits = eurText.replace(/\D/g, '').length
  const half = (digits * 5.4 + (eurText.length - digits) * 2.4 + 3.6) / 2
  const x = Math.max(12, half + 1.5)
  return (
    <span
      className={`price-tag${play ? ' pt-play' : ''}`}
      style={{ '--pt-x': `${x.toFixed(1)}%` } as React.CSSProperties}
      title={title}
      onMouseEnter={() => setPlay(true)}
      onAnimationEnd={() => setPlay(false)}
    >
      <span className="pt-string" />
      <span className="pt-body">
        <span className="pt-hole" />
        <span className="pt-eur">{eurText}</span>
        {cts > 0 && <span className="pt-cts">,{String(cts).padStart(2, '0')}</span>}
        <span className="pt-cur">€</span>
      </span>
    </span>
  )
}
