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

  // Galeries des collectionneurs
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, updated_at')
      .not('lien_csv', 'is', null)
      .neq('lien_csv', '')

    const galeries: MetadataRoute.Sitemap = (profiles || []).map(p => ({
      url: `${base}/galerie/${p.id}`,
      lastModified: new Date(p.updated_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticPages, ...galeries]
  } catch {
    return staticPages
  }
}
