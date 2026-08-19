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
