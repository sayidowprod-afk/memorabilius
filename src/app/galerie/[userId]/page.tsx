import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import GalerieClient from './GalerieClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Résout le paramètre de route (UUID ou slug) vers l'UUID réel une seule
// fois, ici, avant que quoi que ce soit d'autre ne s'en serve. Bug trouvé en
// testant le partage par QR : GalerieClient utilisait le userId brut (donc le
// slug tel quel) pour filtrer ses requêtes user_id — une UUID column ne
// matche jamais une chaîne de type slug, donc toute visite via une URL en
// slug affichait une galerie vide et rendait les actions (suppression,
// bascule privé, renommage de tag...) silencieusement no-op. En résolvant
// ici et en ne passant que l'UUID en aval, tout le composant redevient
// correct sans devoir traquer chaque usage individuellement.
async function resolveUserId(rawUserId: string): Promise<string> {
  if (UUID_RE.test(rawUserId)) return rawUserId
  const { data } = await supabase.from('profiles').select('id').eq('slug', rawUserId).single()
  return data?.id || rawUserId
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ card?: string }>
}): Promise<Metadata> {
  const { userId: rawUserId } = await params
  const { card } = await searchParams
  const cardUrl = card ? decodeURIComponent(card) : null
  const userId = await resolveUserId(rawUserId)

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

// Aperçu purement visuel affiché pendant le chargement réel côté client (voir
// GalerieClient) — seul but : donner quelque chose à regarder plus tôt, sans
// toucher à la logique de chargement/tri/filtres existante qui reste seule
// source de vérité. Volontairement absent pour les galeries encore basées sur
// un CSV externe (ordre différent, imprévisible sans parser le CSV côté serveur).
//
// Note : PreviewCard est dupliqué (structure identique) côté GalerieClient
// plutôt qu'importé, pour garder ce composant client autonome. userId est
// déjà résolu (UUID) à ce stade.
async function fetchInitialPreview(userId: string): Promise<{ cards: PreviewCard[]; grail: PreviewCard[] }> {
  const empty = { cards: [], grail: [] }
  try {
    const { data: profile } = await supabase
      .from('profiles').select('lien_csv, gallery_order').eq('id', userId).single()
    if (!profile || profile.lien_csv) return empty

    const { data: privateRows } = await supabase
      .from('cartes_privees').select('card_key').eq('user_id', userId)
    const privateSet = new Set((privateRows || []).map((r: any) => r.card_key))

    const { data: rows } = await supabase
      .from('cartes_manuelles')
      .select('id, image_recto, is_horizontal, position')
      .eq('user_id', userId)
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
      .from('grail_cards').select('card_key').eq('user_id', userId).order('position').limit(3)
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

export default async function GaleriePage({
  params, searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId: rawUserId } = await params
  const userId = await resolveUserId(rawUserId)

  // Toute visite via l'UUID brut (ancien lien, notification, favori, partage...)
  // bascule automatiquement vers l'URL lisible /galerie/{pseudo} — chaque profil a
  // un slug (voir idx_profiles_slug) depuis longtemps, donc plutôt que de traquer
  // chaque endroit du code qui construit encore un lien en UUID, on corrige la
  // barre d'adresse une bonne fois pour toutes ici, quelle que soit l'origine du lien.
  if (UUID_RE.test(rawUserId)) {
    const { data: profile } = await supabase.from('profiles').select('slug').eq('id', userId).single()
    if (profile?.slug) {
      const sp = await searchParams
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(sp)) {
        if (v == null) continue
        if (Array.isArray(v)) v.forEach(x => qs.append(k, x))
        else qs.set(k, v)
      }
      const suffix = qs.toString()
      redirect(`/galerie/${profile.slug}${suffix ? `?${suffix}` : ''}`)
    }
  }

  const { cards: initialCards, grail: initialGrailCards } = await fetchInitialPreview(userId)
  return (
    <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center', color: '#999', fontSize: 14 }}>Chargement de la galerie…</div>}>
      <GalerieClient userId={userId} initialCards={initialCards} initialGrailCards={initialGrailCards} />
    </Suspense>
  )
}
