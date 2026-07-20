import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import CardPublicPage from '@/components/CardPublicPage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function resolveUserId(userId: string): Promise<string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(userId)) return userId
  const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
  return p?.id || userId
}

async function loadCardRow(resolvedId: string, src?: string) {
  let query = supabase
    .from('cartes_manuelles')
    .select('nom, marque, collection, annee, variation, num, rc, auto, patch, grade, image_recto')
    .eq('user_id', resolvedId)
  // Sans src, on ne peut pas identifier la carte précise parmi toutes celles du
  // collectionneur — mieux vaut ne rien renvoyer qu'une carte au hasard.
  if (src) query = query.eq('image_recto', src)
  else return null
  const { data } = await query.maybeSingle()
  return data
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string; cardSlug: string }>
  searchParams: Promise<{ src?: string }>
}): Promise<Metadata> {
  const { userId, cardSlug } = await params
  const { src } = await searchParams
  const resolvedId = await resolveUserId(userId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', resolvedId)
    .single()
  const name = profile?.display_name || 'a Memorabilius collector'

  const cardRow = await loadCardRow(resolvedId, src)
  const cardName = cardRow?.nom || slugToTitle(cardSlug)
  const setLine = [cardRow?.annee, cardRow?.marque, cardRow?.collection, cardRow?.variation].filter(Boolean).join(' ')
  const title = setLine ? `${cardName} — ${setLine}` : cardName
  const description = cardRow
    ? `${title} trading card, owned by ${name}. View it in interactive 3D, check its numbering, grade and estimated market value on Memorabilius.`
    : `Trading card collection by ${name} on Memorabilius — the platform for sports and TCG card collectors.`
  const imageUrl = src || cardRow?.image_recto || profile?.avatar_url || ''
  const canonical = `https://www.memorabilius.fr/galerie/${userId}/${cardSlug}${src ? `?src=${encodeURIComponent(src)}` : ''}`

  return {
    title: `${title} | Memorabilius`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: imageUrl ? [{ url: imageUrl, width: 400, height: 560, alt: cardName }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
  const resolvedId = await resolveUserId(userId)

  const [{ data: profile }, cardRow] = await Promise.all([
    supabase.from('profiles').select('display_name, slug').eq('id', resolvedId).single(),
    loadCardRow(resolvedId, src),
  ])

  const collectorName = profile?.display_name || 'a Memorabilius collector'
  const cardName = cardRow?.nom || slugToTitle(cardSlug)
  const factLine = [cardRow?.annee, cardRow?.marque, cardRow?.collection, cardRow?.variation].filter(Boolean).join(' ')

  // Données structurées (schema.org) : aide Google à comprendre qu'il s'agit d'un objet
  // de collection précis, avec de meilleures chances d'apparaître en résultat enrichi.
  const jsonLd = cardRow ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: factLine ? `${cardName} ${factLine}` : cardName,
    description: `${cardName} trading card${factLine ? `, ${factLine}` : ''}, part of ${collectorName}'s collection on Memorabilius.`,
    image: cardRow.image_recto || undefined,
    brand: cardRow.marque ? { '@type': 'Brand', name: cardRow.marque } : undefined,
    additionalProperty: [
      cardRow.num ? { '@type': 'PropertyValue', name: 'Numbering', value: cardRow.num } : null,
      cardRow.grade ? { '@type': 'PropertyValue', name: 'Grade', value: cardRow.grade } : null,
      cardRow.rc ? { '@type': 'PropertyValue', name: 'Rookie Card', value: 'Yes' } : null,
      cardRow.auto ? { '@type': 'PropertyValue', name: 'Autographed', value: 'Yes' } : null,
      cardRow.patch ? { '@type': 'PropertyValue', name: 'Patch', value: 'Yes' } : null,
    ].filter(Boolean),
  } : null

  return (
    <>
      {jsonLd && (
        // Échappe '<' pour empêcher une donnée utilisateur (nom de carte, etc.) contenant
        // "</script>" de sortir de la balise script (injection JSON-LD classique).
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}

      {/* Contenu SEO rendu côté serveur : visible immédiatement par les moteurs de
          recherche, sans dépendre de l'exécution du JS client (contrairement au reste
          de la page, plus riche/interactif, qui charge après hydratation). */}
      {cardRow && (
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          <h1>{cardName}{factLine ? ` — ${factLine}` : ''}</h1>
          <p>
            This {cardName} trading card{factLine ? ` (${factLine})` : ''} is part of {collectorName}&apos;s collection
            on Memorabilius, the platform for sports and TCG card collectors. View it in interactive 3D
            {cardRow.num ? `, numbered ${cardRow.num}` : ''}
            {cardRow.grade && cardRow.grade.toLowerCase() !== 'raw' ? `, graded ${cardRow.grade}` : ''}
            {cardRow.rc ? ', rookie card' : ''}{cardRow.auto ? ', autographed' : ''}{cardRow.patch ? ', patch card' : ''}.
          </p>
          <Link href={`/galerie/${profile?.slug || resolvedId}`}>See {collectorName}&apos;s full collection on Memorabilius</Link>
        </div>
      )}

      <Suspense>
        <CardPublicPage userId={resolvedId} cardSlug={cardSlug} src={src} />
      </Suspense>
    </>
  )
}
