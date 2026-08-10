import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const norm = (s: string) =>
  s?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '') || ''

const words = (s: string) =>
  s?.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1) || []

const BRAND_PARENT: Record<string, string> = {
  hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini',
  optic: 'panini', mosaic: 'panini', chronicles: 'panini', contenders: 'panini',
  spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini',
  flawless: 'panini', titanium: 'panini', nationaltreasures: 'panini',
  flux: 'panini', origins: 'panini', courtkings: 'panini', certified: 'panini',
  flagship: 'topps', finest: 'topps', bowman: 'topps', chrome: 'topps',
  heritage: 'topps', stadium: 'topps', update: 'topps',
}
const normBrand = (b: string) => {
  const n = norm(b).replace('america', '').replace('sports', '')
  return BRAND_PARENT[n] ?? n
}

const EXPAND: Record<string, string> = {
  auto: 'autograph', ref: 'refractor', sp: 'shortprint',
  patch: 'patch', mem: 'memorabilia', rpa: 'rookiepatchautograph',
}
const expandWord = (w: string) => EXPAND[w] ?? w

// Mots trop génériques pour discriminer deux sets du même parent brand
const GENERIC_WORDS = new Set([
  'topps', 'panini', 'upper', 'deck', 'leaf', 'donruss', 'fleer', 'score',
  'basketball', 'baseball', 'football', 'hockey', 'soccer',
  'nba', 'nfl', 'mlb', 'nhl', 'trading', 'cards', 'card',
])

function matchVariation(cardVar: string, entryVar: string): boolean {
  const cv = (cardVar || '').trim()
  const ev = (entryVar || '').trim()
  if (!cv && !ev) return true
  if (!cv || !ev) return false
  const nc = norm(cv), ne = norm(ev)
  if (nc === ne) return true
  const cWords = new Set(words(cv).map(expandWord))
  const eWords = new Set(words(ev).map(expandWord))
  if (cWords.size === 0 || eWords.size === 0) return false
  if (![...cWords].every(w => eWords.has(w))) return false
  return cWords.size / eWords.size >= 0.5
}

function matchCollection(cardCollection: string, cardCollectionTag: string, setName: string): boolean {
  const collToTest = (cardCollection || cardCollectionTag || '').trim()
  if (!collToTest) return true // pas de contrainte si non renseigné

  const setNorm = norm(setName)
  const allWords = words(collToTest)
  if (allWords.length === 0) return true

  // Mots spécifiques au produit (hors brand générique)
  const specificWords = allWords.filter(w => !GENERIC_WORDS.has(w))

  if (specificWords.length > 0) {
    // Si la carte a un mot spécifique (ex. "chrome", "bowman", "prizm"),
    // il doit apparaître dans le nom du set
    return specificWords.some(w => setNorm.includes(w))
  }
  // Si la collection ne contient que des mots génériques (ex. "Topps"),
  // on ne peut pas discriminer → on laisse passer (brand + année suffisent)
  return true
}

interface GalleryCard {
  nom: string; annee?: string; marque?: string; collection?: string
  collection_tag?: string; variation?: string; image_recto?: string
}

export async function POST(req: NextRequest) {
  const { setId, setYear, setBrand, setName, entryIds } = await req.json() as {
    setId: number; setYear: number | null; setBrand: string | null
    setName: string; entryIds: number[]
  }
  if (!setId || !entryIds?.length) return NextResponse.json([])

  // 1. Détails des entrées (player_name + variation)
  const { data: entries } = await admin
    .from('card_set_entries')
    .select('id, player_name, variation')
    .in('id', entryIds)
  if (!entries?.length) return NextResponse.json([])

  // 2. Noms de joueurs uniques
  const playerNames = [...new Set(entries.map(e => e.player_name.trim()))]

  // 3. Cartes de TOUS les utilisateurs pour ces joueurs (service role bypass RLS)
  const { data: cards } = await admin.rpc('get_cards_for_players', { p_player_names: playerNames }) as { data: GalleryCard[] | null }
  if (!cards?.length) return NextResponse.json([])

  // 4. Index : norm(nom) → cartes[]
  const byPlayer = new Map<string, GalleryCard[]>()
  for (const c of cards) {
    const key = norm(c.nom || '')
    const arr = byPlayer.get(key) || []
    arr.push(c)
    byPlayer.set(key, arr)
  }

  // 5. Matching identique à set-sync pour chaque entrée
  const y = setYear ?? 0
  const yearStr = String(y)
  const yearNext = y ? `${y}-${String(y + 1).slice(2)}` : ''
  const yearPrev = y ? `${y - 1}-${yearStr.slice(2)}` : ''
  const yearNextFull = y ? String(y + 1) : ''
  const yearFull2 = y ? `${y}-${y + 1}` : ''

  const results: { entry_id: number; image_url: string }[] = []

  for (const entry of entries) {
    const candidates = byPlayer.get(norm(entry.player_name)) || []
    const matched = candidates.find(card => {
      if (y) {
        const cardYear = (card.annee || '').trim()
        if (cardYear && cardYear !== yearStr && cardYear !== yearNext &&
            cardYear !== yearPrev && cardYear !== yearNextFull && cardYear !== yearFull2) return false
      }
      if (card.marque) {
        const normCardRaw = norm(card.marque).replace('america', '').replace('sports', '')
        const normSetNameVal = norm(setName)
        if (BRAND_PARENT[normCardRaw]) {
          // Marque spécifique (ex: "Donruss", "Mosaic") — doit apparaître dans le nom du set
          if (!normSetNameVal.includes(normCardRaw)) return false
        } else if (setBrand) {
          // Marque générique (ex: "Panini", "Topps") — comparer les parents
          const nb = normBrand(card.marque), ns = normBrand(setBrand)
          if (nb && ns && !nb.includes(ns) && !ns.includes(nb)) return false
        }
      }
      if (!matchCollection(card.collection || '', card.collection_tag || '', setName)) return false
      return matchVariation(card.variation || '', entry.variation || '')
    })
    if (matched?.image_recto) {
      results.push({ entry_id: entry.id, image_url: matched.image_recto })
    }
  }

  return NextResponse.json(results)
}
