import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface GalleryCard {
  nom: string
  annee?: string
  marque?: string
  collection?: string
  collection_tag?: string
  variation?: string
  image_recto?: string
}

const BRAND_PARENT: Record<string, string> = {
  hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini',
  optic: 'panini', mosaic: 'panini', chronicles: 'panini', contenders: 'panini',
  spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini',
  revolution: 'panini', eminence: 'panini', illusions: 'panini', nbahoops: 'panini',
  flawless: 'panini', titanium: 'panini', nationaltreasures: 'panini',
  flux: 'panini', origins: 'panini', courtkings: 'panini', certified: 'panini',
  flagship: 'topps', finest: 'topps', bowman: 'topps', chrome: 'topps',
  heritage: 'topps', stadium: 'topps', update: 'topps',
}
const norm = (s: string) =>
  s?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '') || ''
const words = (s: string) =>
  s?.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1) || []
const normBrand = (b: string) => {
  const n = norm(b).replace('america', '').replace('sports', '')
  return BRAND_PARENT[n] ?? n
}

// Abbreviations communs dans le hobby
const EXPAND: Record<string, string> = {
  auto: 'autograph', ref: 'refractor', sp: 'shortprint',
  patch: 'patch', mem: 'memorabilia', rpa: 'rookiepatchautograph',
}
const expandWord = (w: string) => EXPAND[w] ?? w

// Matching de variation plus strict :
// - Tous les mots de la carte user doivent être dans l'entrée
// - La carte user doit décrire ≥50% des mots de l'entrée
//   (évite "Gold" → "Gold Prizm Refractor /25")
function matchVariation(cardVar: string, entryVar: string): boolean {
  const cv = (cardVar || '').trim()
  const ev = (entryVar || '').trim()
  if (!cv && !ev) return true   // les deux sont base
  if (!cv || !ev) return false  // l'un est base, l'autre non

  const nc = norm(cv), ne = norm(ev)
  if (nc === ne) return true    // match exact

  const cWords = new Set(words(cv).map(expandWord))
  const eWords = new Set(words(ev).map(expandWord))
  if (cWords.size === 0 || eWords.size === 0) return false

  // Tous les mots user dans l'entrée
  if (![...cWords].every(w => eWords.has(w))) return false
  // Couverture minimum : l'user décrit ≥50% des mots de l'entrée
  return cWords.size / eWords.size >= 0.5
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { setId, setYear, setBrand, setName, galleryCards, playerImages } = await req.json() as {
    setId: number
    setYear: number | null
    setBrand: string | null
    setName: string
    galleryCards: GalleryCard[]
    playerImages: Record<string, string> // normStr(nom) → image_url
  }
  if (!setId) return NextResponse.json({ error: 'Missing setId' }, { status: 400 })

  // 1. Fetch ALL entries in one query (service role bypasses the 1000-row default limit)
  const { data: allEntries } = await supabase
    .from('card_set_entries')
    .select('id, player_name, variation')
    .eq('set_id', setId)
    .limit(100000)

  const entries = allEntries || []

  // 2. Get completions — prefer RPC JOIN (migration 20260808_set_sync_rpc.sql),
  //    fallback to chunked .in() if RPC not yet deployed.
  const completedEntryIds = new Set<number>()
  const completionDetails: Record<number, { id: string; manually_checked: boolean }> = {}

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_set_completions', {
    p_set_id: setId,
    p_user_id: user.id,
  })

  if (!rpcErr && rpcRows) {
    for (const row of rpcRows) {
      completedEntryIds.add(row.entry_id)
      completionDetails[row.entry_id] = { id: row.completion_id, manually_checked: row.manually_checked }
    }
  } else {
    // Fallback: chunked .in() (max 2000 per chunk to stay under URL limits)
    const entryIds = entries.map(e => e.id)
    const CHUNK = 2000
    for (let i = 0; i < entryIds.length; i += CHUNK) {
      const { data } = await supabase
        .from('user_set_completion')
        .select('id, entry_id, manually_checked')
        .eq('user_id', user.id)
        .in('entry_id', entryIds.slice(i, i + CHUNK))
      for (const c of data || []) {
        completedEntryIds.add(c.entry_id)
        completionDetails[c.entry_id] = { id: c.id, manually_checked: c.manually_checked }
      }
    }
  }

  // 3. Auto-match gallery cards → unmatched entries
  const autoMatchedIds: number[] = []
  const autoMatchedImages: { entry_id: number; image_url: string; user_id: string }[] = []

  if (galleryCards.length > 0 && setYear && entries.length > 0) {
    const y = setYear
    const yearStr = String(y)
    const yearNext = `${y}-${String(y + 1).slice(2)}`
    const yearPrev = `${y - 1}-${yearStr.slice(2)}`
    const yearNextFull = String(y + 1)
    const yearFull2 = `${y}-${y + 1}`

    for (const e of entries) {
      if (completedEntryIds.has(e.id)) continue

      const matched = galleryCards.find(card => {
        if (norm(card.nom) !== norm(e.player_name)) return false

        const cardYear = (card.annee || '').trim()
        if (cardYear && cardYear !== yearStr && cardYear !== yearNext &&
            cardYear !== yearPrev && cardYear !== yearNextFull && cardYear !== yearFull2) return false

        if (setBrand && card.marque) {
          const nb = normBrand(card.marque), ns = normBrand(setBrand)
          if (!nb.includes(ns) && !ns.includes(nb)) return false
        }

        const collToTest = card.collection || card.collection_tag || ''
        if (collToTest) {
          const setNorm = norm(setName)
          const userWords = words(collToTest)
          if (userWords.length > 0 && !userWords.some(w => setNorm.includes(w))) return false
        }

        return matchVariation(card.variation || '', e.variation || '')
      })

      if (matched) {
        completedEntryIds.add(e.id)
        autoMatchedIds.push(e.id)
        // Stocker l'image de la carte exactement matchée (pas juste la première du joueur)
        if (matched.image_recto) {
          autoMatchedImages.push({ entry_id: e.id, image_url: matched.image_recto, user_id: user.id })
        }
      }
    }

    if (autoMatchedIds.length > 0) {
      await supabase
        .from('user_set_completion')
        .upsert(
          autoMatchedIds.map(eid => ({ user_id: user.id, entry_id: eid, manually_checked: false })),
          { onConflict: 'user_id,entry_id', ignoreDuplicates: true }
        )
    }
  }

  // 4b. Stocker les images
  {
    // a) card_set_entries.image_url — image côté site, visible par tous
    //    Seulement les auto-matchés (image exacte de la carte trouvée)
    //    ignoreDuplicates: true pour ne pas écraser une image déjà en place
    if (autoMatchedImages.length > 0) {
      await supabase
        .from('card_set_entries')
        .upsert(
          autoMatchedImages.map(r => ({ id: r.entry_id, image_url: r.image_url })),
          { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    // b) entry_images — image par utilisateur (ownership display)
    const imageRows: { entry_id: number; image_url: string; user_id: string }[] = [...autoMatchedImages]

    if (playerImages && Object.keys(playerImages).length > 0) {
      const autoMatchedEntryIds = new Set(autoMatchedImages.map(r => r.entry_id))
      for (const e of entries) {
        if (!completedEntryIds.has(e.id)) continue
        if (autoMatchedEntryIds.has(e.id)) continue
        const img = playerImages[norm(e.player_name)]
        if (img) imageRows.push({ entry_id: e.id, image_url: img, user_id: user.id })
      }
    }

    if (imageRows.length > 0) {
      await supabase
        .from('entry_images')
        .upsert(imageRows, { onConflict: 'entry_id,user_id' })
    }
  }

  // 5. Build ownedPlayerNorms (pour mySetCards côté client)
  const ownedPlayerNormsSet = new Set<string>()
  for (const e of entries) {
    if (completedEntryIds.has(e.id)) ownedPlayerNormsSet.add(norm(e.player_name))
  }

  return NextResponse.json({
    completedEntryIds: Array.from(completedEntryIds),
    completionDetails,
    autoMatchedCount: autoMatchedIds.length,
    ownedPlayerNorms: Array.from(ownedPlayerNormsSet),
  })
}
