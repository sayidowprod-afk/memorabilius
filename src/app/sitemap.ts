import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.memorabilius.fr'

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/annuaire`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/teams`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/trades`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/recherche`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/tuto`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    const [{ data: profiles }, { data: sets }] = await Promise.all([
      supabase.from('profiles').select('id, updated_at').not('lien_csv', 'is', null).neq('lien_csv', ''),
      supabase.from('card_sets').select('id, updated_at').order('id'),
    ])

    const galeries: MetadataRoute.Sitemap = (profiles || []).map(p => ({
      url: `${base}/galerie/${p.id}`,
      lastModified: new Date((p as any).updated_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const setPages: MetadataRoute.Sitemap = (sets || []).map(s => ({
      url: `${base}/setlist/${s.id}`,
      lastModified: new Date((s as any).updated_at || new Date()),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    return [...staticPages, ...galeries, ...setPages]
  } catch {
    return staticPages
  }
}
