import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { cardPageUrl } from '@/lib/playerSlug'

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
    { url: `${base}/guides`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]

  try {
    const [{ data: profiles }, { data: sets }, { data: guides }, { data: cards }] = await Promise.all([
      supabase.from('profiles').select('id, slug, updated_at'),
      supabase.from('card_sets').select('id, updated_at').order('id'),
      // Contenu editorial (checklists, guides de set) - bon aimant SEO longue traine
      // (ex: "2025-26 Topps Chrome Update checklist").
      supabase.from('guides').select('slug, published_at').eq('published', true).lte('published_at', new Date().toISOString()),
      // Fiches carte individuelles : le vrai aimant à trafic SEO (recherches type
      // "Michael Jordan 1993-94 Upper Deck"). Plafonné pour rester dans une taille de
      // sitemap raisonnable ; priorise les cartes les plus récemment ajoutées.
      supabase.from('cartes_manuelles')
        .select('user_id, nom, annee, marque, collection, image_recto, created_at')
        .not('image_recto', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5000),
    ])

    const galeries: MetadataRoute.Sitemap = (profiles || []).map(p => ({
      url: `${base}/galerie/${(p as any).slug || p.id}`,
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

    const cardPages: MetadataRoute.Sitemap = (cards || [])
      .filter((c: any) => c.nom && c.image_recto)
      .map((c: any) => ({
        url: `${base}${cardPageUrl(c.user_id, c)}`,
        lastModified: new Date(c.created_at || new Date()),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }))

    const guidePages: MetadataRoute.Sitemap = (guides || []).map((g: any) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: new Date(g.published_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticPages, ...galeries, ...setPages, ...cardPages, ...guidePages]
  } catch {
    return staticPages
  }
}
