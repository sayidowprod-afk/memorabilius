import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'
import { teamOk } from '@/lib/wishTeam'

const supabase = createServerClient()

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  const year = req.nextUrl.searchParams.get('year')?.trim() || ''
  const brand = req.nextUrl.searchParams.get('brand')?.trim() || ''
  const set = req.nextUrl.searchParams.get('set')?.trim() || ''
  const variant = req.nextUrl.searchParams.get('variant')?.trim() || ''
  const num = req.nextUrl.searchParams.get('num')?.trim() || ''
  const team = req.nextUrl.searchParams.get('team')?.trim() || '' // équipe de la wishlist : n'affiche que les cartes de cette équipe
  const rc = req.nextUrl.searchParams.get('rc') || ''
  const auto = req.nextUrl.searchParams.get('auto') || ''
  const patch = req.nextUrl.searchParams.get('patch') || ''
  const excludeRaw = req.nextUrl.searchParams.get('exclude') || ''
  // Valide que excludeUserId est un UUID avant de l'utiliser en filtre DB
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const excludeUserId = UUID_RE.test(excludeRaw) ? excludeRaw : ''
  if (!name || name.length < 2) return NextResponse.json([])

  // Incoherent avec les ~15 autres normalisations du site : sans le passage NFD +
  // retrait des diacritiques, un nom accentue ("José", "Dončić") se faisait juste
  // tronquer aux lettres non-accentuees au lieu d'etre translittere -- deux cartes
  // du meme joueur accentue pouvaient ne pas etre detectees comme "la meme carte".
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  // Pour la numérotation : garde seulement le tirage (/99), ignore le numéro individuel (23/99 → 99)
  const normNum = (s: string) => { const m = s.match(/\/(\d+)/); return m ? m[1] : normalize(s) }

  // Cartes manuelles — filtrées côté DB par nom pour réduire les candidats.
  // Pagination complete (sans plafond) -- .limit(500) pouvait exclure la
  // carte identique cherchee pour un joueur tres collectionne avant meme
  // d'atteindre le matching exact plus bas (meme bug que vu ailleurs).
  const safeQ = name.replace(/%/g, '\\%').replace(/_/g, '\\_')
  // first=1 : on n'a besoin que d'une carte (image de l'affiche « Recherché ») -> on s'arrête dès la première page qui en contient une,
  // au lieu de lire toutes les cartes du joueur (jusqu'à plusieurs secondes sur un joueur très collectionné).
  const firstOnly = req.nextUrl.searchParams.get('first') === '1'
  const matchIds = new Set<string>()
  const cardsByUser = new Map<string, any>()

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('cartes_manuelles')
      .select('user_id, nom, equipe, image_recto, annee, marque, collection, variation, num, rc, auto, patch')
      .ilike('nom', `%${safeQ}%`)
      .neq('user_id', excludeUserId || '00000000-0000-0000-0000-000000000000')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break

    // Cartes privées scoped aux user_ids de cette page — évite le scan de 2000 lignes
    const pageUserIds = [...new Set(data.map((m: any) => m.user_id))]
    const { data: privees } = pageUserIds.length > 0
      ? await supabase.from('cartes_privees').select('user_id, card_key').in('user_id', pageUserIds)
      : { data: null }
    const privateSet = new Set((privees || []).map((p: any) => `${p.user_id}::${p.card_key}`))

    data.forEach((m: any) => {
      if (privateSet.has(`${m.user_id}::${m.image_recto}`)) return
      const sameName    = normalize(m.nom || '') === normalize(name)
      const sameYear    = !year    || normalize(m.annee || '')      === normalize(year)
      const sameBrand   = !brand   || normalize(m.marque || '')     === normalize(brand)
      const sameSet     = !set     || normalize(m.collection || '') === normalize(set)
      const sameVariant = !variant || normalize(m.variation || '')  === normalize(variant)
      const sameNum     = !num     || normNum(m.num || '')           === normNum(num)
      const sameTeam    = teamOk(m.equipe, team)
      const sameRc      = !rc      || String(m.rc)    === rc
      const sameAuto    = !auto    || String(m.auto)  === auto
      const samePatch   = !patch   || String(m.patch) === patch
      if (sameName && sameYear && sameBrand && sameSet && sameVariant && sameNum && sameTeam && sameRc && sameAuto && samePatch) {
        matchIds.add(m.user_id)
        if (!cardsByUser.has(m.user_id)) cardsByUser.set(m.user_id, m)
      }
    })
    if ((firstOnly && matchIds.size > 0) || data.length < 1000) break
  }

  if (matchIds.size === 0) return NextResponse.json([])

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, couleur_bordure, slug, is_demo')
    .in('id', [...matchIds])

  const results = (profiles || []).filter(p => !p.is_demo /* compte démo (salons) : invisible */).map(p => ({
    id: p.id,
    slug: p.slug || p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    accent: p.couleur_bordure || '#003DA6',
    cardImg: cardsByUser.get(p.id)?.image_recto,
  }))

  return NextResponse.json(results)
}
