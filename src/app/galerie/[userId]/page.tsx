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
    // Cherche dans les cartes manuelles (cartes CSV n'y sont pas — on affiche quand même l'image)
    const { data: cardRow } = await supabase
      .from('cartes_manuelles')
      .select('nom, marque, collection, annee')
      .eq('user_id', userId)
      .eq('image_recto', cardUrl)
      .maybeSingle()

    const cardName = cardRow?.nom || `Carte de ${name}`
    const cardDesc = cardRow
      ? [cardRow.marque, cardRow.collection, cardRow.annee].filter(Boolean).join(' · ')
      : `Collection de ${name} sur Memorabilius`

    return {
      title: `${cardName} | Memorabilius`,
      description: cardDesc,
      openGraph: {
        title: cardName,
        description: cardDesc,
        images: [{ url: cardUrl, width: 400, height: 560, alt: cardName }],
      },
      twitter: {
        card: 'summary_large_image',
        title: cardName,
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
      // openGraph.images omis → Next.js utilise opengraph-image.tsx (1200×630)
    },
    twitter: {
      card: 'summary_large_image',
      title: `Galerie de ${name} | Memorabilius`,
      description: `Découvrez la collection de cartes de sport de ${name}.`,
    },
  }
}

export interface PreviewCard { id: string; image_recto: string; is_horizontal: boolean }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Aperçu purement visuel affiché pendant le chargement réel côté client (voir
// GalerieClient) — seul but : donner quelque chose à regarder plus tôt, sans
// toucher à la logique de chargement/tri/filtres existante qui reste seule
// source de vérité. Volontairement absent pour les galeries encore basées sur
// un CSV externe (ordre différent, imprévisible sans parser le CSV côté serveur).
//
// Note : PreviewCard est dupliqué (structure identique) côté GalerieClient
// plutôt qu'importé, pour garder ce composant client autonome.
async function fetchInitialPreview(userId: string): Promise<{ cards: PreviewCard[]; grail: PreviewCard[] }> {
  const empty = { cards: [], grail: [] }
  try {
    let resolvedId = userId
    if (!UUID_RE.test(userId)) {
      const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
      if (!p) return empty
      resolvedId = p.id
    }

    const { data: profile } = await supabase
      .from('profiles').select('lien_csv, gallery_order').eq('id', resolvedId).single()
    if (!profile || profile.lien_csv) return empty

    const { data: privateRows } = await supabase
      .from('cartes_privees').select('card_key').eq('user_id', resolvedId)
    const privateSet = new Set((privateRows || []).map((r: any) => r.card_key))

    const { data: rows } = await supabase
      .from('cartes_manuelles')
      .select('id, image_recto, is_horizontal, position')
      .eq('user_id', resolvedId)
      .not('image_recto', 'is', null)
      .order('position', { ascending: true })
      .limit(80)

    let candidates = (rows || []).filter((r: any) => !privateSet.has(r.image_recto))

    const galleryOrder: string[] = profile.gallery_order || []
    if (galleryOrder.length > 0) {
      const orderMap = new Map(galleryOrder.map((key, idx) => [key, idx]))
      candidates = [...candidates].sort((a: any, b: any) =>
        (orderMap.get(a.id) ?? 99999) - (orderMap.get(b.id) ?? 99999))
    }

    const cards: PreviewCard[] = candidates.slice(0, 24)
      .map((r: any) => ({ id: r.id, image_recto: r.image_recto, is_horizontal: !!r.is_horizontal }))

    const { data: grailRows } = await supabase
      .from('grail_cards').select('card_key').eq('user_id', resolvedId).order('position').limit(3)
    const grailKeys = (grailRows || []).map((r: any) => r.card_key).filter((k: string) => !privateSet.has(k))
    let grail: PreviewCard[] = []
    if (grailKeys.length > 0) {
      const { data: grailCardRows } = await supabase
        .from('cartes_manuelles').select('id, image_recto, is_horizontal')
        .in('image_recto', grailKeys)
      const byKey = new Map((grailCardRows || []).map((r: any) => [r.image_recto, r]))
      grail = grailKeys
        .map(k => byKey.get(k))
        .filter(Boolean)
        .map((r: any) => ({ id: r.id, image_recto: r.image_recto, is_horizontal: !!r.is_horizontal }))
    }

    return { cards, grail }
  } catch {
    return empty
  }
}

export default async function GaleriePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const { cards: initialCards, grail: initialGrailCards } = await fetchInitialPreview(userId)
  return (
    <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center', color: '#999', fontSize: 14 }}>Chargement de la galerie…</div>}>
      <GalerieClient userId={userId} initialCards={initialCards} initialGrailCards={initialGrailCards} />
    </Suspense>
  )
}
