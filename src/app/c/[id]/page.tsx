import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function loadLink(id: string) {
  const { data } = await supabase
    .from('csv_card_links').select('user_id, image_url').eq('id', id).maybeSingle()
  return data
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const link = await loadLink(id)
  if (!link) return { title: 'Carte | Memorabilius' }

  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', link.user_id).single()

  const title = `Carte de ${profile?.display_name || 'collectionneur'} | Memorabilius`

  return {
    title,
    openGraph: { title, images: [{ url: link.image_url, width: 400, height: 560 }] },
    twitter: { card: 'summary_large_image', title, images: [link.image_url] },
  }
}

// Lien court partageable pour une carte CSV (pas de ligne cartes_manuelles, donc pas
// d'UUID à utiliser dans /s/{id} comme pour les cartes ajoutées manuellement) — voir
// supabase/migrations/20260821_csv_card_links.sql et src/lib/csvCardShortLink.ts.
// Redirige vers le mécanisme d'ouverture de popup existant (?card=) une fois résolu.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const link = await loadLink(id)
  if (!link) redirect('/')

  const { data: profile } = await supabase
    .from('profiles').select('slug').eq('id', link.user_id).single()

  redirect(`/galerie/${profile?.slug || link.user_id}?card=${encodeURIComponent(link.image_url)}`)
}
