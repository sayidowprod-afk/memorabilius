import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import CardSharePage from '@/components/CardSharePage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata(
  { params }: { params: Promise<{ cardId: string }> }
): Promise<Metadata> {
  const { cardId } = await params
  const { data: card } = await supabase
    .from('cartes_manuelles')
    .select('nom, marque, collection, annee, image_recto, user_id')
    .eq('id', cardId)
    .single()

  if (!card) return { title: 'Carte | Memorabilius' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', card.user_id)
    .single()

  const title = `${card.nom}${profile?.display_name ? ` · ${profile.display_name}` : ''} | Memorabilius`
  const desc  = [card.marque, card.collection, card.annee].filter(Boolean).join(' · ')

  return {
    title,
    description: desc,
    openGraph: {
      title, description: desc,
      images: card.image_recto ? [{ url: card.image_recto, width: 400, height: 560 }] : [],
    },
    twitter: {
      card: 'summary_large_image', title, description: desc,
      images: card.image_recto ? [card.image_recto] : [],
    },
  }
}

export default async function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params
  return <CardSharePage cardId={cardId} />
}
