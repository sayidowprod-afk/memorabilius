import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rootEntryIds } from '@/lib/setFamilies'
import { candidatesForCard, pickEntry, type MSet, type MEntry } from '@/lib/setMatcher'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface GalleryCard {
  id?: string   // cartes_manuelles UUID (absent pour les cartes CSV)
  nom: string
  annee?: string
  marque?: string
  collection?: string
  collection_tag?: string
  variation?: string
  image_recto?: string
  card_number?: string
  set_entry_id?: number | null  // lien manuel explicite → jamais auto-matché ailleurs
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

// Mots trop génériques pour, seuls, désigner un produit précis (voir setlist/page.tsx
// pour le contexte complet — même correctif appliqué des deux côtés).
const GENERIC_WORDS = new Set([
  'panini', 'topps', 'upperdeck', 'upper', 'deck', 'nba', 'nfl', 'mlb', 'nhl',
  'basketball', 'football', 'baseball', 'hockey', 'cards', 'card', 'the', 'and',
])

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

  // galleryCards vient entièrement du client, jamais revérifié — un utilisateur
  // pouvait soumettre des cartes entièrement inventées pour (a) se marquer comme
  // propriétaire d'entrées de checklist qu'il ne possède pas, et pire, (b) faire
  // écrire une image_recto arbitraire dans card_set_entries.image_url, visible
  // par TOUS les visiteurs du set. On revérifie ici les cartes ayant un `id`
  // (= cartes_manuelles réelles) contre la base : seule leur vraie ligne sert de
  // matching et d'image, jamais les valeurs déclarées par le client. Les cartes
  // sans id (import CSV externe) restent utilisables pour le matching (moins
  // grave : n'affecte que la complétion propre à cet utilisateur) mais jamais
  // pour l'image publique partagée (voir plus bas, filtre sur `verified`).
  const claimedIds = (galleryCards || []).map(c => c.id).filter(Boolean) as string[]
  const verifiedRows = claimedIds.length
    ? (await supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, collection, variation, image_recto, set_entry_id, card_number')
        .eq('user_id', user.id).in('id', claimedIds)).data || []
    : []
  const verifiedById = new Map(verifiedRows.map(r => [r.id, r]))
  const safeGalleryCards: (GalleryCard & { verified: boolean })[] = (galleryCards || []).map(c => {
    if (!c.id) return { ...c, verified: false }
    const real = verifiedById.get(c.id)
    if (!real) return { ...c, id: undefined, verified: false } // id inventé/pas à lui → traité comme non vérifié, sans id pour ne pas écrire dans cartes_manuelles d'un autre
    return { ...c, ...real, verified: true }
  })

  // 1. Toutes les entrees du set, PAGINEES : PostgREST plafonne chaque reponse a 1000 lignes (max_rows), meme en
  //    service role et malgre .limit(100000) -- sur un set de 15 000 cartes, seules les 1000 premieres arrivaient,
  //    donc cases cochees perdues, auto-detection tronquee et "7 cartes" en haut de page.
  const PAGE = 1000
  const entries: { id: number; player_name: string; variation: string | null; card_number: string | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await supabase
      .from('card_set_entries')
      .select('id, player_name, variation, card_number')
      .eq('set_id', setId)
      .order('id')
      .range(from, from + PAGE - 1)
    if (!page?.length) break
    entries.push(...(page as any[]))
    if (page.length < PAGE) break
  }

  // 2. Get completions — prefer RPC JOIN (migration 20260808_set_sync_rpc.sql),
  //    fallback to chunked .in() if RPC not yet deployed.
  const completedEntryIds = new Set<number>()
  const completionDetails: Record<number, { id: string; manually_checked: boolean; matched_card_key?: string | null }> = {}

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_set_completions', {
    p_set_id: setId,
    p_user_id: user.id,
  })

  // Le RPC est plafonne a 1000 lignes comme le reste : s'il echoue OU atteint le plafond, on relit les completions
  // de l'utilisateur par pages (index user_id, entry_id), bornees aux identifiants du set.
  if (!rpcErr && rpcRows && rpcRows.length < PAGE) {
    for (const row of rpcRows) {
      completedEntryIds.add(row.entry_id)
      completionDetails[row.entry_id] = { id: row.completion_id, manually_checked: row.manually_checked, matched_card_key: row.matched_card_key || null }
    }
  } else {
    if (rpcErr) console.error('set-sync: get_set_completions a echoue, lecture par pages', rpcErr.message)
    const inSet = new Set(entries.map(e => e.id))
    if (entries.length) {
      const lo = entries[0].id, hi = entries[entries.length - 1].id
      for (let from = 0; ; from += PAGE) {
        const { data } = await supabase
          .from('user_set_completion')
          .select('id, entry_id, manually_checked, matched_card_key')
          .eq('user_id', user.id)
          .gte('entry_id', lo).lte('entry_id', hi)
          .order('entry_id')
          .range(from, from + PAGE - 1)
        if (!data?.length) break
        for (const c of data as any[]) {
          if (!inSet.has(c.entry_id)) continue
          completedEntryIds.add(c.entry_id)
          completionDetails[c.entry_id] = { id: c.id, manually_checked: c.manually_checked, matched_card_key: c.matched_card_key || null }
        }
        if (data.length < PAGE) break
      }
    }
  }

  // 3. Auto-match gallery cards → entries du set.
  //    REGLES (strictes : mieux vaut rater une carte que valider la mauvaise) :
  //    - joueur identique, annee compatible (OBLIGATOIRE si le set a une annee), marque compatible ;
  //    - collection : les mots "produit" de la carte (hors marque, annee, mots generiques) doivent etre EXACTEMENT ceux du set
  //      ("Hoops" ne valide plus "Hoops Premium Stock", "Prizm Draft Picks" ne valide plus "Prizm") ;
  //    - variation compatible ; numero de carte identique quand les deux sont renseignes ;
  //    - UNE carte ne valide qu'UNE entree : si plusieurs entrees restent possibles (ex. deux numeros pour le meme joueur),
  //      la carte est ignoree plutot que de cocher toutes les entrees. Aucun lien set_entry_id n'est plus ecrit automatiquement
  //      (un lien auto errone devenait un lien "manuel" definitif).
  const autoMatchedIds: number[] = []
  const autoMatchedImages: { entry_id: number; image_url: string; user_id: string }[] = []
  const autoSet = new Set<number>()

  if (safeGalleryCards.length > 0 && entries.length > 0) {
    // moteur commun (lib/setMatcher.ts) : memes regles que la synchronisation de tous les sets
    const metaSet = new Map<number, MSet>([[setId, { id: setId, name: setName, year: setYear, brand: setBrand }]])
    const asEntries: MEntry[] = entries.map(e => ({ id: e.id, player_name: e.player_name, variation: e.variation, set_id: setId, card_number: e.card_number }))
    const roots = rootEntryIds(asEntries)
    const byPlayer = new Map<string, MEntry[]>()
    for (const e of asEntries) {
      if (!roots.has(e.id)) continue
      const k = norm(e.player_name)
      const arr = byPlayer.get(k) || []
      arr.push(e); byPlayer.set(k, arr)
    }

    for (const card of safeGalleryCards) {
      const pool = byPlayer.get(norm(card.nom))
      if (!pool?.length) continue
      const e = pickEntry(candidatesForCard(card, pool, metaSet))
      if (!e || autoSet.has(e.id)) continue
      autoSet.add(e.id)
      if (!completedEntryIds.has(e.id)) {
        completedEntryIds.add(e.id)
        autoMatchedIds.push(e.id)
      }
      if (card.image_recto && card.verified) autoMatchedImages.push({ entry_id: e.id, image_url: card.image_recto, user_id: user.id })
    }

    // Nettoyage : anciennes validations AUTOMATIQUES (jamais cochees a la main, sans carte choisie) qui ne correspondent plus
    // aux regles ci-dessus (faux positifs des anciennes versions) -> retirees.
    const stale: string[] = []
    for (const [eid, det] of Object.entries(completionDetails)) {
      const id = Number(eid)
      if (!det.manually_checked && !det.matched_card_key && !autoSet.has(id)) {
        stale.push(det.id); completedEntryIds.delete(id); delete completionDetails[id]
      }
    }
    for (let i = 0; i < stale.length; i += 500) {
      await supabase.from('user_set_completion').delete().eq('user_id', user.id).in('id', stale.slice(i, i + 500))
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
    // image publique de l'entree : seulement les auto-matchees avec une carte VERIFIEE ; ignoreDuplicates pour ne rien ecraser
    if (autoMatchedImages.length > 0) {
      await supabase
        .from('card_set_entries')
        .upsert(
          autoMatchedImages.map(r => ({ id: r.entry_id, image_url: r.image_url })),
          { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    // image par utilisateur : la carte reellement matchee, ou la carte explicitement choisie. PLUS de repli "meme nom de joueur"
    // (il affichait la carte d'un AUTRE set pour une case cochee a la main).
    const imageRows: { entry_id: number; image_url: string; user_id: string }[] = [...autoMatchedImages]
    const have = new Set(imageRows.map(r => r.entry_id))
    for (const e of entries) {
      if (!completedEntryIds.has(e.id) || have.has(e.id)) continue
      const matchedKey = completionDetails[e.id]?.matched_card_key
      if (matchedKey) imageRows.push({ entry_id: e.id, image_url: matchedKey, user_id: user.id })
    }
    if (imageRows.length > 0) {
      await supabase.from('entry_images').upsert(imageRows, { onConflict: 'entry_id,user_id' })
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
