import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { cardPageUrl } from '@/lib/playerSlug'

// Sitemap de TOUTES les fiches carte (+ sitemap d'images pour Google Images), decoupe en tranches :
// une tranche = CHUNK cartes, servie sur /cartes/sitemap/<id>.xml (limite Google : 50 000 URLs / fichier).
// Le sitemap racine (src/app/sitemap.ts) ne contient plus les cartes ; robots.ts liste ces tranches.
export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CHUNK = 5000
const PAGE = 1000 // plafond PostgREST par requete

export async function generateSitemaps() {
  // Compte estime (un count exact sur ~90k lignes peut depasser le statement timeout) + 1 tranche de marge
  const { count } = await supabase
    .from('cartes_manuelles')
    .select('id', { count: 'estimated', head: true })
  const n = Math.max(1, Math.ceil((count || 0) / CHUNK) + 1)
  return Array.from({ length: n }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = parseInt(await props.id, 10) || 0
  const base = 'https://www.memorabilius.fr'
  const out: MetadataRoute.Sitemap = []
  try {
    for (let off = id * CHUNK; off < (id + 1) * CHUNK; off += PAGE) {
      const { data, error } = await supabase
        .from('cartes_manuelles')
        .select('id, user_id, nom, annee, marque, collection, image_recto, created_at')
        .not('image_recto', 'is', null)
        .order('id')
        .range(off, off + PAGE - 1)
      if (error || !data?.length) break
      for (const c of data as any[]) {
        if (!c.nom || !/^https?:\/\//.test(c.image_recto || '')) continue
        out.push({
          url: `${base}${cardPageUrl(c.user_id, c)}`,
          lastModified: new Date(c.created_at || Date.now()),
          changeFrequency: 'monthly',
          priority: 0.6,
          images: [c.image_recto],
        })
      }
      if (data.length < PAGE) break
    }
  } catch {}
  return out
}
