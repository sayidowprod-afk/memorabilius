import { PACK_CARDS } from '@/lib/packs'

// Visuel du pack (image générée, fond détouré) + textes en HTML : « 6 cartes » reste net et traduisible.
// Dessiné 2 fois dans la fenêtre d'ouverture (bande du haut et corps), découpées par le même bord déchiré.
export function PackArt() {
  return (
    <div className="pk-art-img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/packs/pack-classic.webp?v=1" alt="" draggable={false} />
      <div className="lbl-bot"><em>{PACK_CARDS} CARTES</em><small>1 RARE GARANTIE</small></div>
      <div className="sheen"><i /></div>
    </div>
  )
}
