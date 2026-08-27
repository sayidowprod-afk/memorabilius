import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/lib/LangContext'
import { guidesI18n } from '@/lib/guidesI18n'
import GuidesAdminBar from '@/components/GuidesAdminBar'
import GuidesListClient, { type GuideListItem } from '@/components/GuidesListClient'

export const revalidate = 300

// Composant serveur : pas de useLang() (hook client) disponible ici. La langue est
// resolue au mieux via le cookie geo-lang pose par le middleware (voir
// middleware.ts) - moins precis que la resolution complete cote client (qui priorise
// aussi un choix explicite en localStorage), mais c'est le compromis accepte pour
// avoir un vrai rendu serveur (SEO) sur ces pages de contenu.
async function resolveLang(): Promise<Lang> {
  const store = await cookies()
  const geo = store.get('geo-lang')?.value
  return geo === 'en' || geo === 'de' ? geo : 'fr'
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveLang()
  const t = guidesI18n[lang]
  return {
    title: `${t.guides_title} | Memorabilius`,
    description: t.guides_subtitle,
    openGraph: { title: `${t.guides_title} | Memorabilius`, description: t.guides_subtitle },
  }
}

interface Guide {
  id: number
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string | null
  published_at: string
}

async function fetchGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('guides')
    .select('id, slug, title, excerpt, cover_image, category, published_at')
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  if (error) console.error('[guides] Supabase error:', error.message)
  return data || []
}

// Pour EN/DE : n'affiche que le titre/résumé/image traduits — le fr et les
// données non-textuelles (category, slug) restent la source de vérité. Un
// guide sans traduction pour la langue courante garde son contenu fr (mieux
// qu'un titre manquant) mais pointe quand même vers /guides/{slug} en fr.
async function fetchTranslationsMap(guideIds: number[], lang: 'en' | 'de' | 'es' | 'it'): Promise<Record<number, { title: string; excerpt: string | null; cover_image: string | null }>> {
  if (guideIds.length === 0) return {}
  const { data } = await supabase
    .from('guide_translations')
    .select('guide_id, title, excerpt, cover_image')
    .eq('lang', lang)
    .in('guide_id', guideIds)
  const map: Record<number, { title: string; excerpt: string | null; cover_image: string | null }> = {}
  ;(data || []).forEach(r => { map[r.guide_id] = { title: r.title, excerpt: r.excerpt, cover_image: r.cover_image } })
  return map
}

export default async function GuidesPage() {
  const [guides, lang] = await Promise.all([fetchGuides(), resolveLang()])
  const t = guidesI18n[lang]
  const transMap = lang === 'fr' ? {} : await fetchTranslationsMap(guides.map(g => g.id), lang)

  const items: GuideListItem[] = guides.map(g => {
    const tr = transMap[g.id]
    return {
      slug: g.slug,
      title: tr?.title || g.title,
      excerpt: tr?.excerpt ?? g.excerpt,
      cover_image: (tr?.cover_image || g.cover_image) ?? null,
      category: g.category,
      href: tr ? `/${lang}/guides/${g.slug}` : `/guides/${g.slug}`,
    }
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px', margin: '0 0 6px' }}>{t.guides_title}</h1>
      <p style={{ color: 'var(--text2, #777)', fontSize: 14, margin: '0 0 20px' }}>
        {t.guides_subtitle}
      </p>

      <GuidesAdminBar />

      {items.length === 0 ? (
        <p style={{ color: 'var(--text3, #999)' }}>{t.guides_empty}</p>
      ) : (
        <GuidesListClient
          guides={items}
          searchPlaceholder={t.guides_search_placeholder}
          filterAllLabel={t.guides_filter_all}
          noResultsLabel={t.guides_no_results}
        />
      )}
    </div>
  )
}
