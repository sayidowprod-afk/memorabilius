'use client'
import { useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

const TXT: Record<string, { plus: (n: number) => string; coll: string; hint: string }> = {
  fr: { plus: n => n > 1 ? `+${n} cartes` : '+1 carte', coll: 'Ta collection', hint: 'Touche pour continuer' },
  en: { plus: n => n > 1 ? `+${n} cards` : '+1 card', coll: 'Your collection', hint: 'Tap to continue' },
  de: { plus: n => n > 1 ? `+${n} Karten` : '+1 Karte', coll: 'Deine Sammlung', hint: 'Tippen zum Fortfahren' },
  es: { plus: n => n > 1 ? `+${n} cartas` : '+1 carta', coll: 'Tu colección', hint: 'Toca para continuar' },
  it: { plus: n => n > 1 ? `+${n} carte` : '+1 carta', coll: 'La tua collezione', hint: 'Tocca per continuare' },
}

// Ouverture de paquet : apres l'ajout d'une carte, un paquet scelle se dechire et la carte en sort VRAIMENT de sa pochette
// (pas un simple fondu devant). Plein ecran, se ferme seul au bout de 4,1 s ou au toucher ; tout est en CSS (voir .pr-* dans da.css).
// Les 3 pieces sont des SOEURS avec un z-index explicite (pas le rabat/dos imbriques) : la carte est la plus BASSE de la
// pile -- tant qu'elle est encore "dans" le paquet (sous le bord du dos), le dos opaque la cache reellement (occlusion, pas
// opacite) ; elle ne devient visible qu'en montant au-dessus de ce bord, comme tiree hors d'une pochette. Le rabat du dessus
// se dechire en premier (flourish), puis le dos se dissout une fois la carte presque sortie pour finir la revelation.
// `count` : nombre de cartes ajoutees depuis la derniere ouverture (session de scan debounced
// cote appelant, voir ajouter/page.tsx) -- affiche "+1 carte" seulement si une seule l'a ete.
export default function PackReveal({ image, total, count = 1, onClose }: { image: string; total?: number; count?: number; onClose: () => void }) {
  const { lang } = useLang()
  const T = TXT[lang] || TXT.en
  useEffect(() => {
    const id = setTimeout(onClose, 4300)
    return () => clearTimeout(id)
  }, [onClose])
  return (
    <div className="pr" onClick={onClose} role="dialog" aria-label={T.plus(count)}>
      <div className="pr-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pr-card" src={image} alt="" />
        <div className="pr-body"><span className="da-display">Memorabilius</span></div>
        <div className="pr-top" />
      </div>
      <div className="pr-txt">
        <div className="da-display pr-plus">{T.plus(count)}</div>
        {total !== undefined && <div className="pr-sub">{T.coll} : {total}</div>}
        <div className="pr-hint">{T.hint}</div>
      </div>
    </div>
  )
}
