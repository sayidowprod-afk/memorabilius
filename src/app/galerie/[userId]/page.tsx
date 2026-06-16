import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import GalerieClient from './GalerieClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ card?: string }>
}): Promise<Metadata> {
  const { userId } = await params
  const { card } = await searchParams
  const cardUrl = card ? decodeURIComponent(card) : null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .single()
  const name = profile?.display_name || 'Collectionneur'

  if (cardUrl) {
    const { data: cardRow } = await supabase
      .from('cartes_manuelles')
      .select('nom, marque, collection, annee')
      .eq('user_id', userId)
      .eq('image_recto', cardUrl)
      .single()

    const cardName = cardRow?.nom || 'Carte'
    const cardDesc = [cardRow?.marque, cardRow?.collection, cardRow?.annee].filter(Boolean).join(' · ')

    return {
      title: `${cardName} — ${name} | Memorabilius`,
      description: cardDesc || `Carte de la collection de ${name} sur Memorabilius.`,
      openGraph: {
        title: `${cardName} — ${name}`,
        description: cardDesc || `Collection de ${name} sur Memorabilius`,
        images: [{ url: cardUrl, width: 400, height: 560, alt: cardName }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${cardName} — ${name}`,
        description: cardDesc,
        images: [cardUrl],
      },
    }
  }

  return {
    title: `Galerie de ${name} | Memorabilius`,
    description: `Découvrez la collection de cartes de sport de ${name} sur Memorabilius.`,
    openGraph: {
      title: `Galerie de ${name} | Memorabilius`,
      description: `Découvrez la collection de cartes de sport de ${name}.`,
      images: profile?.avatar_url ? [{ url: profile.avatar_url, width: 200, height: 200, alt: name }] : [],
    },
    twitter: {
      card: 'summary',
      title: `Galerie de ${name} | Memorabilius`,
      description: `Découvrez la collection de cartes de sport de ${name}.`,
    },
  }
}

export default async function GaleriePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return (
    <Suspense>
      <GalerieClient userId={userId} />
    </Suspense>
  )
}
