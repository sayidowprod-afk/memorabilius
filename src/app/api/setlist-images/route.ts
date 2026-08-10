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

// Parent brands et mots de sport — pas les sous-produits (Mosaic, Prizm, Donruss…)
const PARENT_WORDS = new Set([
  'panini', 'topps', 'upper', 'deck', 'leaf', 'fleer',
  'basketball', 'baseball', 'football', 'hockey', 'soccer',
  'nba', 'nfl', 'mlb', 'nhl', 'trading', 'cards', 'card', 'sport', 'sports',
])

// Extraire les mots produit spécifiques d'un set (ex: ["mosaic"] pour "2024-25 Panini Mosaic")
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

  // ── ÉTAPE 1 : images déjà vérifiées via la synchronisation (entry_images) ──
  // La sync set-sync a déjà fait le matching exact carte↔entrée → source de vérité
  const { data: syncedImages } = await admin
    .from('entry_images')
    .select('entry_id, image_url')
    .in('entry_id', entryIds)
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .limit(10000)

  for (const row of syncedImages || []) {
    if (!results.has(row.entry_id)) results.set(row.entry_id, row.image_url)
  }

  // ── ÉTAPE 2 : fuzzy match strict pour les entrées sans image synchée ──
  const missing = entryIds.filter(id => !results.has(id))
  if (missing.length > 0) {
    // Détails des entrées manquantes (joueur, numéro de carte, variation)
    const { data: entries } = await admin
      .from('card_set_entries')
      .select('id, player_name, card_number, variation')
      .in('id', missing)
    if (entries?.length) {
      const playerNames = [...new Set(entries.map((e: any) => e.player_name.trim()))]

      // Toutes les cartes communauté pour ces joueurs (avec card_number maintenant)
      const { data: cards } = await admin.rpc('get_cards_for_players', {
        p_player_names: playerNames,
      }) as { data: GalleryCard[] | null }

      if (cards?.length) {
        // Index joueur → cartes
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

        // Mots produit spécifiques du set (ex: ["mosaic"])
        const specificWords = getSetSpecificWords(setName)

        for (const entry of entries as any[]) {
          const candidates = byPlayer.get(norm(entry.player_name)) || []
          const matched = candidates.find(card => {
            // Année
            if (y) {
              const cardYear = (card.annee || '').trim()
              if (cardYear && cardYear !== yearStr && cardYear !== yearNext &&
                  cardYear !== yearPrev && cardYear !== yearNextFull && cardYear !== yearFull2) return false
            }

            // Collection / marque : on rejette SEULEMENT si la carte a une info spécifique
            // qui contredit le set. Si pas d'info spécifique → ambiguë → laisser passer.
            if (specificWords.length > 0) {
              const cardCollText = (card.collection || '') + ' ' + (card.collection_tag || '')
              const cardSpecific = [...words(card.marque || ''), ...words(cardCollText)]
                .filter(w => w.length > 2 && !PARENT_WORDS.has(w) && !/^\d+$/.test(w))
              if (cardSpecific.length > 0) {
                // La carte a une info produit spécifique → elle doit chevaucher le set
                const matches = cardSpecific.some(w => specificWords.includes(w))
                  || specificWords.some(w => cardSpecific.includes(w))
                if (!matches) return false
              }
              // cardSpecific vide → pas d'info discriminante → on laisse passer
            } else if (setBrand && card.marque) {
              // Set sans mot spécifique → vérifier au moins la brand parente
              const nb = norm(card.marque), ns = norm(setBrand)
              if (nb && ns && !nb.includes(ns) && !ns.includes(nb)) return false
            }

            // Numéro de carte : si les deux sont renseignés, ils doivent correspondre
            if (entry.card_number && card.card_number) {
              const nc = norm(entry.card_number), cc = norm(card.card_number)
              if (nc && cc && nc !== cc) return false
            }

            // Variation (insert, parallel, etc.)
            return matchVariation(card.variation || '', entry.variation || '')
          })

          if (matched?.image_recto) {
            results.set(entry.id, matched.image_recto)
          }
        }
      }
    }
  }

  return NextResponse.json(
    [...results.entries()].map(([entry_id, image_url]) => ({ entry_id, image_url }))
  )
}
