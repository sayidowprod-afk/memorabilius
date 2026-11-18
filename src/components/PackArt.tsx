import { PACK_CARDS } from '@/lib/packs'

// L'illustration du pack (dessinée 3 fois : corps, bande du haut déchirée, bande du haut restante)
export function PackArt() {
  return (
    <div className="pk-art-pack">
      <div className="crimp top" /><div className="crimp bot" />
      <div className="wrinkles" /><div className="holo" /><div className="sheen" />
      <div className="lbl-top">MEMORABILIUS</div>
      <div className="lbl-mid"><b>PACK</b><span>BOOSTER</span></div>
      <div className="lbl-bot"><em>{PACK_CARDS} CARTES</em><small>1 RARE GARANTIE</small></div>
    </div>
  )
}
