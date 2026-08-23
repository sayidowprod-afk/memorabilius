import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { normalizeGuideBlocks, type GuideBlock } from '@/lib/guideBlockTypes'
import { GuideArticle } from '@/lib/guidePageRender'

export const revalidate = 300

interface Guide {
  id: number
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string | null
  content: string
  blocks: GuideBlock[]
  published_at: string
}

async function fetchGuide(slug: string): Promise<Guide | null> {
  const { data } = await supabase
    .from('guides')
    .select('id, title, excerpt, cover_image, category, content, blocks, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .single()
  if (!data) return null
  return { ...data, blocks: normalizeGuideBlocks(data.blocks, data.content) }
}

// Langues traduites disponibles pour ce guide (voir /[lang]/guides/[slug] et
// supabase/migrations/20260823_guide_translations.sql) — sert à générer les
// balises hreflang pour que Google sache que ce sont des versions du même
// contenu, pas du contenu dupliqué.
async function fetchAvailableLangs(guideId: number): Promise<string[]> {
  const { data } = await supabase.from('guide_translations').select('lang').eq('guide_id', guideId)
  return (data || []).map(r => r.lang)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = await fetchGuide(slug)
  if (!guide) return { title: 'Guide | Memorabilius' }
  const title = `${guide.title} | Memorabilius`
  const description = guide.excerpt || undefined
  const langs = await fetchAvailableLangs(guide.id)
  const languages: Record<string, string> = { fr: `https://www.memorabilius.fr/guides/${slug}` }
  for (const lang of langs) languages[lang] = `https://www.memorabilius.fr/${lang}/guides/${slug}`
  return {
    title, description,
    alternates: { canonical: `https://www.memorabilius.fr/guides/${slug}`, languages },
    openGraph: { title, description, images: guide.cover_image ? [guide.cover_image] : undefined },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = await fetchGuide(slug)
  if (!guide) notFound()

  // /guides/[slug] est la source française — un visiteur qui a choisi anglais/allemand
  // pour le site (sélecteur de langue, cookie geo-lang) atterrissait quand même sur le
  // contenu français si le lien qu'il suivait pointait ici plutôt que directement vers
  // /{lang}/guides/{slug}. Redirige automatiquement vers la traduction dès qu'elle
  // existe, pour tout point d'entrée (nav, lien partagé, recherche...).
  const geoLang = (await cookies()).get('geo-lang')?.value
  if (geoLang === 'en' || geoLang === 'de') {
    const { data: translation } = await supabase
      .from('guide_translations').select('lang').eq('guide_id', guide.id).eq('lang', geoLang).maybeSingle()
    if (translation) redirect(`/${geoLang}/guides/${slug}`)
  }

  return (
    <GuideArticle data={{
      title: guide.title,
      excerpt: guide.excerpt,
      coverImage: guide.cover_image,
      category: guide.category,
      blocks: guide.blocks,
      publishedAt: guide.published_at,
      backLabel: '← Retour aux guides',
      backHref: '/guides',
      tocLabel: 'Sommaire',
      dateLocale: 'fr-FR',
    }} />
  )
}
