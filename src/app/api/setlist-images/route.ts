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

// Mots génériques qui ne distinguent pas les produits entre eux
const PARENT_WORDS = new Set([
  'panini', 'topps', 'upper', 'deck', 'leaf', 'fleer',
  'basketball', 'baseball', 'football', 'hockey', 'soccer',
  'nba', 'nfl', 'mlb', 'nhl', 'trading', 'cards', 'card', 'sport', 'sports',
])

// Ex: "2024-25 Panini Mosaic" → ["mosaic"]
// Ex: "2024-25 Panini Prizm" → ["prizm"]
// Ex: "2024-25 Panini" → [] (aucun mot produit spécifique)
function getSetSpecificWords(setName: string): string[] {
  return setName.toLowerCase().split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !PARENT_WORDS.has(w) && !/^\d+$/.test(w))
}

const EXPAND: Record<string, string> = {
  auto: 'autograph', ref: 'refractor', sp: 'shortprint',
  patch: 'patch', mem: 'memorabilia', rpa: 'rookiepatchautograph',
}
const expandWord = (w: string) => EXPAND[w] ?? w

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

interface GalleryCard {
  nom: string; annee?: string; marque?: string; collection?: string
  collection_tag?: string; variation?: string; card_number?: string; image_recto?: string
}

export async function POST(req: NextRequest) {
  const { setId, setYear, setBrand, setName, entryIds } = await req.json() as {
    setId: number; setYear: number | null; setBrand: string | null
    setName: string; entryIds: number[]
  }
  if (!setId || !entryIds?.length) return NextResponse.json([])

  const results = new Map<number, string>()

  // ─── ÉTAPE 1 : fuzzy strict sur toutes les cartes communauté ───────────────
  // Conditions pour qu'une carte soit retenue :
  //   • l'année doit correspondre (si la carte n'a pas d'année et le set en a une → rejetée)
  //   • les mots produit du set (mosaic, prizm…) doivent être dans les champs collection/marque
  //   • la variation doit correspondre
  // → jamais de Donruss sur une Mosaic, jamais de 2021 sur un set 2024
  {
    const { data: rawEntries } = await admin
      .from('card_set_entries')
      .select('id, player_name, card_number, variation')
      .in('id', entryIds)

    const entries = (rawEntries || []) as {
      id: number; player_name: string; card_number: string | null; variation: string | null
    }[]

    if (entries.length > 0) {
      const playerNames = [...new Set(entries.map(e => e.player_name.trim()))]

      const { data: cards } = await admin.rpc('get_cards_for_players', {
        p_player_names: playerNames,
      }) as { data: GalleryCard[] | null }

      if (cards?.length) {
        const byPlayer = new Map<string, GalleryCard[]>()
        for (const c of cards) {
          const key = norm(c.nom || '')
          const arr = byPlayer.get(key) || []
          arr.push(c)
          byPlayer.set(key, arr)
        }

        const y = setYear ?? 0
        const yearStr = String(y)
        const yearNext = y ? `${y}-${String(y + 1).slice(2)}` : ''
        const yearPrev = y ? `${y - 1}-${yearStr.slice(2)}` : ''
        const yearNextFull = y ? String(y + 1) : ''
        const yearFull2 = y ? `${y}-${y + 1}` : ''
        const specificWords = getSetSpecificWords(setName)

        for (const entry of entries) {
          const candidates = byPlayer.get(norm(entry.player_name)) || []
          const matched = candidates.find(card => {
            // Année obligatoire si le set en a une
            const cardYear = (card.annee || '').trim()
            if (y) {
              if (!cardYear) return false  // carte sans année → rejetée
              if (cardYear !== yearStr && cardYear !== yearNext &&
                  cardYear !== yearPrev && cardYear !== yearNextFull && cardYear !== yearFull2) return false
            }

            // Collection : les mots produit du set doivent être présents dans la carte
            if (specificWords.length > 0) {
              const cardText = norm(
                (card.marque || '') + ' ' + (card.collection || '') + ' ' + (card.collection_tag || '')
              )
              if (!specificWords.some(w => cardText.includes(w))) return false
            } else if (setBrand && card.marque) {
              const nb = norm(card.marque), ns = norm(setBrand)
              if (nb && ns && !nb.includes(ns) && !ns.includes(nb)) return false
            }

            // Numéro de carte (si les deux sont renseignés)
            if (entry.card_number && card.card_number) {
              const nc = norm(entry.card_number), cc = norm(card.card_number)
              if (nc && cc && nc !== cc) return false
            }

            return matchVariation(card.variation || '', entry.variation || '')
          })

          if (matched?.image_recto) {
            results.set(entry.id, matched.image_recto)
          }
        }

        // Sauvegarder dans card_set_entries.image_url pour les futurs visiteurs
        // (silencieux si la colonne n'existe pas encore — migration à appliquer séparément)
        if (results.size > 0) {
          admin.from('card_set_entries').upsert(
            [...results.entries()].map(([id, image_url]) => ({ id, image_url })),
            { onConflict: 'id', ignoreDuplicates: true }
          ).then(() => {}) // fire and forget
        }
      }
    }
  }

  // ─── ÉTAPE 2 : fallback entry_images pour les entrées sans match fuzzy ─────
  // Couvre les cartes sans info collection/année ou les joueurs peu représentés
  const missing = entryIds.filter(id => !results.has(id))
  if (missing.length > 0) {
    const { data: syncedImages } = await admin
      .from('entry_images')
      .select('entry_id, image_url')
      .in('entry_id', missing)
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .limit(10000)

    for (const row of (syncedImages || [])) {
      if (!results.has(row.entry_id)) results.set(row.entry_id, row.image_url)
    }
  }

  return NextResponse.json(
    [...results.entries()].map(([entry_id, image_url]) => ({ entry_id, image_url }))
  )
}
