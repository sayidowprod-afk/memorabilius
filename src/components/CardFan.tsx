'use client'
import { useState } from 'react'

// Eventail des 3 dernieres cartes (la plus recente devant, a droite). Sert d'en-tete visuel : profil de galerie,
// equipe... L'orientation de chaque image est lue au chargement (carte horizontale = cadre horizontal, jamais rognee).
// Masque sous 900px de large (les en-tetes y sont deja pleins). Coins toujours nets.
export default function CardFan({ images, width = 92 }: { images: string[]; width?: number }) {
  const [land, setLand] = useState<Record<number, boolean>>({})
  const list = images.filter(Boolean).slice(0, 3)
  if (!list.length) return null
  return (
    <div className="cfan" aria-hidden style={{ ['--w' as string]: `${width}px` }}>
      {list.map((src, i) => ({ src, i })).reverse().map(({ src, i }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" loading="lazy"
          className={`cfan-card cfan-${i}${land[i] ? ' cfan-h' : ''}`}
          onLoad={e => { const h = e.currentTarget.naturalWidth > e.currentTarget.naturalHeight; setLand(p => (p[i] === h ? p : { ...p, [i]: h })) }} />
      ))}
    </div>
  )
}
