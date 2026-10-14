'use client'
import { useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

const TXT: Record<string, { plus: string; coll: string; hint: string }> = {
  fr: { plus: '+1 carte', coll: 'Ta collection', hint: 'Touche pour continuer' },
  en: { plus: '+1 card', coll: 'Your collection', hint: 'Tap to continue' },
  de: { plus: '+1 Karte', coll: 'Deine Sammlung', hint: 'Tippen zum Fortfahren' },
  es: { plus: '+1 carta', coll: 'Tu colección', hint: 'Toca para continuar' },
  it: { plus: '+1 carta', coll: 'La tua collezione', hint: 'Tocca per continuare' },
}

// Ouverture de paquet : apres l'ajout d'une carte, un paquet scelle se dechire et la carte en sort VRAIMENT de sa pochette
// (pas un simple fondu devant). Plein ecran, se ferme seul au bout de 4,1 s ou au toucher ; tout est en CSS (voir .pr-* dans da.css).
// Les 3 pieces sont des SOEURS avec un z-index explicite (pas le rabat/dos imbriques) : la carte est la plus BASSE de la
// pile -- tant qu'elle est encore "dans" le paquet (sous le bord du dos), le dos opaque la cache reellement (occlusion, pas
// opacite) ; elle ne devient visible qu'en montant au-dessus de ce bord, comme tiree hors d'une pochette. Le rabat du dessus
// se dechire en premier (flourish), puis le dos se dissout une fois la carte presque sortie pour finir la revelation.
export default function PackReveal({ image, total, onClose }: { image: string; total?: number; onClose: () => void }) {
  const { lang } = useLang()
  const T = TXT[lang] || TXT.en
  useEffect(() => {
    const id = setTimeout(onClose, 4300)
    return () => clearTimeout(id)
  }, [onClose])
  return (
    <div className="pr" onClick={onClose} role="dialog" aria-label={T.plus}>
      <div className="pr-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pr-card" src={image} alt="" />
        <div className="pr-body"><span className="da-display">Memorabilius</span></div>
        <div className="pr-top" />
      </div>
      <div className="pr-txt">
        <div className="da-display pr-plus">{T.plus}</div>
        {total !== undefined && <div className="pr-sub">{T.coll} : {total}</div>}
        <div className="pr-hint">{T.hint}</div>
      </div>
    </div>
  )
}
