// Cartes "horizontales" stockees dans leur fichier brut en orientation
// portrait (contenu tourne) -- meme convention que l'affichage grille
// (GalerieClient.tsx, transform: rotate(90deg), sens horaire). Reproduit ici
// via canvas pour obtenir une image "upright" utilisable comme source stable
// (dimensions dans le bon sens) par l'outil de crop et le presentateur du
// quiz autographes.
export function loadUprightImage(src: string, isHorizontal: boolean): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      if (isHorizontal) {
        canvas.width = img.naturalHeight
        canvas.height = img.naturalWidth
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(img, 0, 0)
      } else {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
      }
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}
