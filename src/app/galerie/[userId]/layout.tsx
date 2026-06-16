import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams?: Promise<{ card?: string }> }): Promise<Metadata> {
  const { userId } = await params
  const sp = searchParams ? await searchParams : {}
  const cardUrl = sp?.card ? decodeURIComponent(sp.card) : null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .single()
  const name = profile?.display_name || 'Collectionneur'

  // Lien partagé avec une carte spécifique
  if (cardUrl) {
    // Cherche la carte dans les cartes manuelles pour avoir son nom
    const { data: cardRow } = await supabase
      .from('cartes_manuelles')
      .select('nom, variante, brand, set_name, year')
      .eq('user_id', userId)
      .eq('front_url', cardUrl)
      .single()

    const cardName = cardRow?.nom || 'Carte'
    const cardDesc = [cardRow?.brand, cardRow?.set_name, cardRow?.year].filter(Boolean).join(' · ')

    return {
      title: `${cardName} — Collection de ${name} | Memorabilius`,
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

  // Page galerie normale
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

export default function GalerieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
