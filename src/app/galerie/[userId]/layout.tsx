import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .single()
  const name = profile?.display_name || 'Collectionneur'
  return {
    title: `Galerie de ${name}`,
    description: `Découvrez la collection de cartes de sport de ${name} sur Memorabilius.`,
    openGraph: {
      title: `Galerie de ${name} | Memorabilius`,
      description: `Découvrez la collection de cartes de sport de ${name}.`,
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
  }
}

export default function GalerieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
