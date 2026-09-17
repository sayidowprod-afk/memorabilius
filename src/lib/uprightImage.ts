// Cartes "horizontales" stockees dans leur fichier brut en orientation
// portrait (contenu tourne) -- meme convention que l'affichage grille
// (GalerieClient.tsx, transform: rotate(90deg), sens horaire). Reproduit ici
// via canvas pour obtenir une image "upright" utilisable comme source stable
// (dimensions dans le bon sens) par l'outil de crop et le presentateur du
// quiz autographes.
//
// rotationDeg accepte 0/90/180/270 (sens horaire) -- pas juste un booleen :
// is_horizontal en base ne code que 0 vs 90, mais certaines cartes ont besoin
// de 180 ou 270 (erreur de saisie, orientation d'upload variable), d'ou le
// bouton "Pivoter" qui doit pouvoir cycler sur les 4 valeurs.
export function loadUprightImage(src: string, rotationDeg: number): Promise<HTMLCanvasElement> {
  const deg = ((rotationDeg % 360) + 360) % 360
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (deg === 90 || deg === 270) {
        canvas.width = h
        canvas.height = w
      } else {
        canvas.width = w
        canvas.height = h
      }
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((deg * Math.PI) / 180)
      ctx.drawImage(img, -w / 2, -h / 2)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}
