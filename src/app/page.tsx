import { supabase } from '@/lib/supabase'
import PepitesSection from '@/components/PepitesSection'
import HomeHero from '@/components/HomeHero'
import PodiumSection from '@/components/PodiumSection'
import PWAInstall from '@/components/PWAInstall'
import NativeHomeGate from '@/components/NativeHomeGate'

// ISR : rebuild en arrière-plan toutes les 5 min, instantané pour les visiteurs
export const revalidate = 300

interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string; isHorizontal: boolean
}

interface FeaturedGallery {
  id: string; display_name: string; avatar_url: string | null
  stats_total: number; topCards: string[]
}

async function fetchPepites(): Promise<Card[]> {
  const { data: manuelles, error } = await supabase
    .from('cartes_manuelles')
    .select('image_recto, nom, variation, annee, marque, rc, auto, patch, num, user_id, is_horizontal')
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) console.error('[fetchPepites] Supabase error:', error.message)
  if (!manuelles?.length) return []

  // Scope profiles to only the user_ids present in the 200 cards — évite de charger tous les profils
  const userIds = [...new Set(manuelles.map(m => m.user_id))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  // Dédupliquer par image et ne garder que les cartes avec un profil connu
  const seen = new Set<string>()
  const items = (manuelles || []).filter(m => {
    if (!m.image_recto || !profileMap.get(m.user_id)) return false
    if (seen.has(m.image_recto)) return false
    seen.add(m.image_recto)
    return true
  }).map(m => ({
    img: m.image_recto as string,
    name: m.nom || '',
    variant: m.variation || '',
    year: m.annee || '',
    brand: m.marque || '',
    rc: m.rc || false,
    auto: m.auto || false,
    patch: m.patch || false,
    num: m.num || '',
    collector: profileMap.get(m.user_id) as string,
    userId: m.user_id,
    isHorizontal: m.is_horizontal || false,
  }))

  // Toujours 18 cartes (tant qu'il y en a assez) — les plus récentes, sans
  // condition de diversité par utilisateur.
  const PEPITES_COUNT = 18
  return items.slice(0, PEPITES_COUNT)
}

async function fetchFeaturedGalleries(): Promise<FeaturedGallery[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, stats_total')
    .not('display_name', 'is', null)
    .neq('display_name', '')
    .gt('stats_total', 0)
    .order('stats_total', { ascending: false })
    .limit(3)

  if (!profiles || profiles.length === 0) return []

  const withCards = await Promise.all(profiles.map(async p => {
    const { data } = await supabase
      .from('cartes_manuelles')
      .select('image_recto')
      .eq('user_id', p.id)
      .not('image_recto', 'is', null)
      .eq('is_horizontal', false)
      .limit(3)
    const topCards = (data || []).map((r: any) => r.image_recto).filter(Boolean)
    return { ...p, topCards }
  }))

  return withCards.filter(g => g.topCards.length > 0)
}

async function fetchPodium() {
  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const counts = new Map<string, { displayName: string; avatarUrl: string | null; count: number }>()

  // Source 1 : monthly_additions — tenu à jour en temps réel (synchro CSV + ajouts manuels via /api/card-added)
  try {
    const { data } = await supabase
      .from('monthly_additions')
      .select('user_id, count, profiles(display_name, avatar_url)')
      .eq('month', month)
    for (const row of (data || []) as any[]) {
      if (!row.profiles?.display_name) continue
      counts.set(row.user_id, { displayName: row.profiles.display_name, avatarUrl: row.profiles.avatar_url || null, count: row.count })
    }
  } catch {}

  // Source 2 : cartes_manuelles agrégées côté DB en une seule requête (remplace la boucle while paginée)
  const { data: fallback } = await supabase
    .rpc('get_monthly_card_counts', { p_start: startOfMonth })
  for (const row of (fallback || []) as any[]) {
    if (!row.display_name) continue
    const existing = counts.get(row.user_id)
    if (!existing) counts.set(row.user_id, { displayName: row.display_name, avatarUrl: row.avatar_url || null, count: Number(row.count) })
    else if (Number(row.count) > existing.count) existing.count = Number(row.count)
  }

  return [...counts.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

async function fetchPodiumPeriod(pStart: string) {
  // Agrégation côté DB en une seule requête (même RPC que le podium mensuel) —
  // remplace l'ancienne pagination manuelle par page de 1000, devenue trop
  // lente au fil de la croissance de cartes_manuelles (faisait dépasser le
  // budget de build de la page d'accueil).
  const { data } = await supabase.rpc('get_monthly_card_counts', { p_start: pStart })
  return ((data || []) as any[])
    .filter(row => row.display_name)
    .map(row => ({ userId: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url || null, count: Number(row.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

async function fetchPodiumDay() {
  // dernières 24h (évite les problèmes de timezone)
  const start = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  return fetchPodiumPeriod(start)
}

async function fetchPodiumWeek() {
  const start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  return fetchPodiumPeriod(start)
}

export default async function Home() {
  const [
    { count },
    { data: statsData },
    { count: bindersCount },
    { count: tradeCount },
    cards,
    podium,
    podiumDay,
    podiumWeek,
    featuredGalleries,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('stats_total').gt('stats_total', 0),
    supabase.from('binders').select('*', { count: 'exact', head: true }).neq('is_public', false).gte('page_count', 1),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true),
    fetchPepites(),
    fetchPodium(),
    fetchPodiumDay(),
    fetchPodiumWeek(),
    fetchFeaturedGalleries(),
  ])

  const total = count ?? 0
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0
  const totalBinders = bindersCount ?? 0
  const totalTrade = tradeCount ?? 0

  const navJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      { '@type': 'SiteNavigationElement', position: 1, name: 'Annuaire des collectionneurs', url: 'https://www.memorabilius.fr/annuaire' },
      { '@type': 'SiteNavigationElement', position: 2, name: 'Recherche de cartes', url: 'https://www.memorabilius.fr/recherche' },
      { '@type': 'SiteNavigationElement', position: 3, name: 'Scanner de prix', url: 'https://www.memorabilius.fr/scanner' },
      { '@type': 'SiteNavigationElement', position: 4, name: 'Équipes de collectionneurs', url: 'https://www.memorabilius.fr/teams' },
      { '@type': 'SiteNavigationElement', position: 5, name: 'Échanges', url: 'https://www.memorabilius.fr/echanges' },
    ],
  }

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }} />
      <NativeHomeGate
        hero={<HomeHero total={total} totalCartes={totalCartes} totalBinders={totalBinders} totalTrade={totalTrade} featuredGalleries={featuredGalleries} />}
        siteStats={{ total, totalCartes, totalBinders, totalTrade }}
      />
      <PepitesSection cards={cards} />
      <PodiumSection month={podium} week={podiumWeek} day={podiumDay} />
      <PWAInstall />
    </div>
  )
}
