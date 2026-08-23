import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { normalizeGuideBlocks } from '@/lib/guideBlockTypes'
import { GuideArticle } from '@/lib/guidePageRender'
import { verifyPreviewToken } from '@/lib/guidePreviewToken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Aperçu de la page finale d'un guide, sans avoir à cocher "publié" — même rendu
// pixel pour pixel que /guides/[slug] (réutilise GuideArticle), mais bypasse le
// filtre published/published_at, protégé par un jeton signé à durée limitée (voir
// src/lib/guidePreviewToken.ts, généré depuis /admin/guides/[id]) plutôt que par
// une vérification de session — aucune session/cookie ne voyage jusqu'ici.
export const metadata: Metadata = { robots: { index: false, follow: false } }

async function fetchDraftGuide(slug: string) {
  const { data } = await supabase
    .from('guides')
    .select('id, title, excerpt, cover_image, category, content, blocks, published_at')
    .eq('slug', slug)
    .single()
  return data
}

export default async function GuidePreviewPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams
  if (!token) notFound()

  const guide = await fetchDraftGuide(slug)
  if (!guide) notFound()
  if (!verifyPreviewToken(token, guide.id)) notFound()

  const blocks = normalizeGuideBlocks(guide.blocks, guide.content)

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#e67e22', color: 'white',
        textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 800,
      }}>
        👁️ Aperçu — cette page n'est pas publiée
      </div>
      <GuideArticle data={{
        title: guide.title,
        excerpt: guide.excerpt,
        coverImage: guide.cover_image,
        category: guide.category,
        blocks,
        publishedAt: guide.published_at || new Date().toISOString(),
        backLabel: '← Retour à l\'édition',
        backHref: `/admin/guides/${guide.id}`,
        tocLabel: 'Sommaire',
        dateLocale: 'fr-FR',
      }} />
    </>
  )
}
