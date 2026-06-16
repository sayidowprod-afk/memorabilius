import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import CardPublicPage from '@/components/CardPublicPage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; cardSlug: string }>
  searchParams: Promise<{ src?: string }>
}): Promise<Metadata> {
  const { userId, cardSlug } = await params
  const { src } = await searchParams

  // Résoudre userId ou slug
  let resolvedId = userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
    if (p) resolvedId = p.id
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', resolvedId)
    .single()
  const name = profile?.display_name || 'Collectionneur'

  // Cherche la carte dans cartes_manuelles pour enrichir le titre
  const { data: cardRow } = await supabase
    .from('cartes_manuelles')
    .select('nom, marque, collection, annee, image_recto')
    .eq('user_id', resolvedId)
    .maybeSingle()

  const cardName = cardRow?.nom || slugToTitle(cardSlug)
  const cardDesc = cardRow
    ? [cardRow.marque, cardRow.collection, cardRow.annee].filter(Boolean).join(' · ')
    : `Collection de ${name} sur Memorabilius`
  const imageUrl = src || cardRow?.image_recto || profile?.avatar_url || ''

  return {
    title: `${cardName} — ${name} | Memorabilius`,
    description: cardDesc,
    openGraph: {
      title: `${cardName} — ${name}`,
      description: cardDesc,
      images: imageUrl ? [{ url: imageUrl, width: 400, height: 560, alt: cardName }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${cardName} — ${name}`,
      description: cardDesc,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

function slugToTitle(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; cardSlug: string }>
  searchParams: Promise<{ src?: string }>
}) {
  const { userId, cardSlug } = await params
  const { src } = await searchParams

  // Résoudre slug → UUID pour le client
  let resolvedId = userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
    if (p) resolvedId = p.id
  }

  return (
    <Suspense>
      <CardPublicPage userId={resolvedId} cardSlug={cardSlug} src={src} />
    </Suspense>
  )
}
