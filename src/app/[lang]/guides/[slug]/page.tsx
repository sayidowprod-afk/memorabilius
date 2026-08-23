import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { normalizeGuideBlocks, type GuideBlock } from '@/lib/guideBlockTypes'
import { GuideArticle } from '@/lib/guidePageRender'

export const revalidate = 300

const SUPPORTED_LANGS = ['en', 'de'] as const
type TransLang = typeof SUPPORTED_LANGS[number]

const CHROME: Record<TransLang, { back: string; toc: string; locale: string }> = {
  en: { back: '← Back to guides', toc: 'Table of contents', locale: 'en-US' },
  de: { back: '← Zurück zu den Guides', toc: 'Inhaltsverzeichnis', locale: 'de-DE' },
}

interface GuideMeta {
  id: number
  cover_image: string | null
  category: string | null
  published_at: string
}

interface Translation {
  title: string
  excerpt: string | null
  cover_image: string | null
  blocks: GuideBlock[]
}

// Traduction générée par IA d'un guide (voir /api/translate-guide et
// supabase/migrations/20260823_guide_translations.sql) — le français reste
// la source de vérité sur /guides/[slug], cette route sert les versions EN/DE
// sur leur propre URL indexable (nécessaire pour le bénéfice SEO : une seule
// URL avec contenu qui change selon un cookie n'est jamais vue par Google
// comme du contenu traduit).
async function fetchGuideMeta(slug: string): Promise<GuideMeta | null> {
  const { data } = await supabase
    .from('guides')
    .select('id, cover_image, category, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .single()
  return data
}

async function fetchTranslation(guideId: number, lang: TransLang): Promise<Translation | null> {
  const { data } = await supabase
    .from('guide_translations')
    .select('title, excerpt, cover_image, blocks')
    .eq('guide_id', guideId).eq('lang', lang)
    .maybeSingle()
  if (!data) return null
  return { title: data.title, excerpt: data.excerpt, cover_image: data.cover_image, blocks: normalizeGuideBlocks(data.blocks, '') }
}

async function fetchAvailableLangs(guideId: number): Promise<string[]> {
  const { data } = await supabase.from('guide_translations').select('lang').eq('guide_id', guideId)
  return (data || []).map(r => r.lang)
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params
  if (!SUPPORTED_LANGS.includes(lang as TransLang)) return { title: 'Guide | Memorabilius' }
  const meta = await fetchGuideMeta(slug)
  if (!meta) return { title: 'Guide | Memorabilius' }
  const translation = await fetchTranslation(meta.id, lang as TransLang)
  if (!translation) return { title: 'Guide | Memorabilius' }

  const title = `${translation.title} | Memorabilius`
  const description = translation.excerpt || undefined
  const image = translation.cover_image || meta.cover_image
  const langs = await fetchAvailableLangs(meta.id)
  const languages: Record<string, string> = { fr: `https://www.memorabilius.fr/guides/${slug}` }
  for (const l of langs) languages[l] = `https://www.memorabilius.fr/${l}/guides/${slug}`
  return {
    title, description,
    alternates: { canonical: `https://www.memorabilius.fr/${lang}/guides/${slug}`, languages },
    openGraph: { title, description, images: image ? [image] : undefined },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TranslatedGuidePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params
  if (!SUPPORTED_LANGS.includes(lang as TransLang)) notFound()
  const l = lang as TransLang

  const meta = await fetchGuideMeta(slug)
  if (!meta) notFound()
  const translation = await fetchTranslation(meta.id, l)
  if (!translation) notFound()

  const chrome = CHROME[l]

  return (
    <GuideArticle data={{
      title: translation.title,
      excerpt: translation.excerpt,
      coverImage: translation.cover_image || meta.cover_image,
      category: meta.category,
      blocks: translation.blocks,
      publishedAt: meta.published_at,
      backLabel: chrome.back,
      backHref: '/guides',
      tocLabel: chrome.toc,
      dateLocale: chrome.locale,
    }} />
  )
}
