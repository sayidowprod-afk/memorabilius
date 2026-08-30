// Convertit le cadre de recadrage manuel (position/rotation/zoom affichés à
// l'écran) en coordonnées des 4 coins de la carte sur la photo ORIGINALE,
// normalisées 0-1 (ordre tl/tr/br/bl) -- même format que la détection auto
// du scanner (CardScanner), pour que ces recadrages manuels alimentent aussi
// le dataset d'entraînement des coins.
//
// Dérivé en inversant exactement la même séquence de transforms canvas
// utilisée pour construire outCanvas (translate -> rotate -> scale ->
// drawImage), donc les coins renvoyés ici correspondent pixel pour pixel à
// la région réellement extraite par le recadrage.
export function cropFrameToOriginalCorners(params: {
  outCanvasW: number
  outCanvasH: number
  frameX: number
  frameY: number
  cw: number
  ch: number
  imgTransform: { x: number; y: number; scale: number }
  pixelScale: number
  angleRad: number
  naturalWidth: number
  naturalHeight: number
}): { x: number; y: number }[] {
  const { outCanvasW, outCanvasH, frameX, frameY, cw, ch, imgTransform, pixelScale, angleRad, naturalWidth, naturalHeight } = params
  const s = imgTransform.scale * pixelScale
  const Tx = (cw / 2 + imgTransform.x - frameX) * pixelScale
  const Ty = (ch / 2 + imgTransform.y - frameY) * pixelScale
  const cosT = Math.cos(angleRad)
  const sinT = Math.sin(angleRad)

  const outCorners: [number, number][] = [[0, 0], [outCanvasW, 0], [outCanvasW, outCanvasH], [0, outCanvasH]] // tl, tr, br, bl

  return outCorners.map(([ox, oy]) => {
    const dx = ox - Tx
    const dy = oy - Ty
    // Rotation inverse (rotate de -angleRad)
    const rx = cosT * dx + sinT * dy
    const ry = -sinT * dx + cosT * dy
    // Echelle et decalage centre->origine inverses
    const px = rx / s + naturalWidth / 2
    const py = ry / s + naturalHeight / 2
    return { x: px / naturalWidth, y: py / naturalHeight }
  })
}
