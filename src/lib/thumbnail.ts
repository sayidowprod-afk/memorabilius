// Miniature d'une carte pour la grille de la galerie : ~520 px sur le grand côté, JPEG, environ 40 à 60 Ko (la photo complète fait ~150 Ko).
// Créée à l'ajout (ajout d'une carte, ajout en lot, remplacement de photo) et stockée à côté de la photo : la grille charge ces miniatures
// (2 à 4 fois plus légères) pendant que le viewer garde la photo complète. Aucune transformation facturée.
export const THUMB_MAX = 520
export const THUMB_QUALITY = 0.8

export async function makeThumb(source: Blob, max = THUMB_MAX, quality = THUMB_QUALITY): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(source)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>(res => c.toBlob(b => res(b), 'image/jpeg', quality))
    c.width = c.height = 0
    return blob
  } catch { return null }
}
