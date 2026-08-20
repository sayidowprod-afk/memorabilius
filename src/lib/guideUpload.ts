import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// Upload d'image partagé pour tout le contenu de guide (corps Tiptap, couverture,
// lignes de pyramide, cartes insert) — même pattern que le reste de l'app
// (src/app/profil/page.tsx), un seul bucket dédié guide-images.
export async function uploadGuideImage(file: File, prefix = ''): Promise<string | null> {
  if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return null }
  const ext = file.name.split('.').pop()
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('guide-images').upload(path, file)
  if (error) { toast.error("Erreur d'upload : " + error.message); return null }
  const { data } = supabase.storage.from('guide-images').getPublicUrl(path)
  return data.publicUrl
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const dims = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dims
}

// Pivote un fichier image de 90° (sens horaire) via canvas, renvoie un nouveau File
// du même type MIME.
async function rotateImage90(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.height
  canvas.height = bitmap.width
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), file.type || 'image/png', 0.92))
  return new File([blob], file.name, { type: file.type || 'image/png' })
}

// Upload d'une image d'exemple de carte (pyramide, grille d'inserts) : une carte de
// collection est presque toujours au format portrait, mais un scan/photo posé à
// l'horizontale (ou une image multi-cartes) s'affiche alors recadrée/écrasée dans
// les aperçus (cases fixes en ratio portrait, voir PyramidBlock/InsertGridBlock). Si
// le fichier est détecté au format paysage, propose à l'admin de le pivoter à 90°
// avant l'upload plutôt que de le découvrir a posteriori sur le rendu public.
export async function uploadGuideCardImage(file: File, prefix = ''): Promise<string | null> {
  try {
    const { width, height } = await imageDimensions(file)
    if (width > height && window.confirm('Cette image semble au format paysage — la pivoter à 90° pour un affichage correct sur la carte ?')) {
      file = await rotateImage90(file)
    }
  } catch {
    // Dimensions indétectables (format exotique...) : on upload tel quel.
  }
  return uploadGuideImage(file, prefix)
}
