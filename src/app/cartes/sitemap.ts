import { MetadataRoute } from 'next'
import { cardPageUrl } from '@/lib/playerSlug'
import { createServerClient } from '@/lib/supabaseServer'
import { demoUserIds } from '@/lib/demoUsers'
import { rpcOnePage, rpcScalar } from '@/lib/fastCards'

// Sitemap de TOUTES les fiches carte (+ sitemap d'images pour Google Images), decoupe en tranches :
// une tranche = CHUNK cartes, servie sur /cartes/sitemap/<id>.xml (limite Google : 50 000 URLs / fichier).
// Le sitemap racine (src/app/sitemap.ts) ne contient plus les cartes ; robots.ts liste ces tranches.
export const revalidate = 604800 // 7 jours (etait 24h, 1h avant -- contenu quasi statique, cf. reduction couts Vercel ISR)

const supabase = createServerClient()

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
    const demo = await demoUserIds(supabase) // compte démo (salons) : jamais référencé
    const add = (data: any[]) => {
      for (const c of data) {
        if (demo.has(c.user_id) || !c.nom || !/^https?:\/\//.test(c.image_recto || '')) continue
        out.push({
          url: `${base}${cardPageUrl(c.user_id, c)}`,
          lastModified: new Date(c.created_at || Date.now()),
          changeFrequency: 'monthly',
          priority: 0.6,
          images: [c.image_recto],
        })
      }
    }

    // Pagination par curseur (migration 20261201) : bornes de la tranche, puis pages « id > dernier id vu » lues sur l'index (quelques ms) ;
    // la version par décalage (offset) coûtait 500 à 900 ms par page. Repli sur l'ancienne méthode si les fonctions n'existent pas encore.
    const startB = id === 0 ? { ok: true, value: null as string | null } : await rpcScalar(supabase, 'sitemap_start_id', { p_offset: id * CHUNK - 1 })
    const endB = await rpcScalar(supabase, 'sitemap_start_id', { p_offset: (id + 1) * CHUNK - 1 })
    if (startB.ok && endB.ok) {
      if (id > 0 && !startB.value) return out   // au-delà de la dernière carte : tranche vide
      let cursor = startB.value
      let failed = false
      for (let n = 0; n < CHUNK / PAGE + 1; n++) {
        const rows = await rpcOnePage(supabase, 'sitemap_cards_after', { p_after: cursor, p_until: endB.value, p_limit: PAGE })
        if (!rows) { failed = true; break }   // échec en cours de route : on repart sur l'ancienne méthode ci-dessous
        if (!rows.length) return out
        add(rows)
        cursor = rows[rows.length - 1].id
        if (rows.length < PAGE) return out
      }
      if (!failed) return out
      out.length = 0
    }

    for (let off = id * CHUNK; off < (id + 1) * CHUNK; off += PAGE) {
      const { data, error } = await supabase
        .from('cartes_manuelles')
        .select('id, user_id, nom, annee, marque, collection, image_recto, created_at')
        .not('image_recto', 'is', null)
        .order('id')
        .range(off, off + PAGE - 1)
      if (error || !data?.length) break
      add(data as any[])
      if (data.length < PAGE) break
    }
  } catch {}
  return out
}
