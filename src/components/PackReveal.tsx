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

// Ouverture de paquet : apres l'ajout d'une carte, un paquet scelle se dechire et la carte en sort. Plein ecran, se ferme seul
// au bout de 4,2 s ou au toucher ; tout est en CSS (voir .pr-* dans da.css).
export default function PackReveal({ image, total, onClose }: { image: string; total?: number; onClose: () => void }) {
  const { lang } = useLang()
  const T = TXT[lang] || TXT.en
  useEffect(() => {
    const id = setTimeout(onClose, 4200)
    return () => clearTimeout(id)
  }, [onClose])
  return (
    <div className="pr" onClick={onClose} role="dialog" aria-label={T.plus}>
      <div className="pr-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pr-card" src={image} alt="" />
        <div className="pr-pack">
          <div className="pr-top" />
          <div className="pr-body"><span className="da-display">Memorabilius</span></div>
        </div>
      </div>
      <div className="pr-txt">
        <div className="da-display pr-plus">{T.plus}</div>
        {total !== undefined && <div className="pr-sub">{T.coll} : {total}</div>}
        <div className="pr-hint">{T.hint}</div>
      </div>
    </div>
  )
}
