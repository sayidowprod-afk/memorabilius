'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'

interface CardSet {
  id: number
  tcdb_id: number | null
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
  owned?: number
  pct?: number
}

interface GalleryCard {
  nom: string; annee: string; marque: string; collection: string; collection_tag: string; variation: string; card_number?: string
}

interface SetCandidate {
  setId: number; setName: string; setYear: number | null; entryId: number
}

interface UnmatchedCard extends GalleryCard {
  candidates: SetCandidate[]
}

function CompletionBar({ pct, dark = false }: { pct: number; dark?: boolean }) {
  const color = pct >= 80 ? '#2ecc71' : pct >= 40 ? '#f39c12' : pct > 0 ? '#3498db' : '#e0e0e0'
  return (
    <div style={{ height: 5, borderRadius: 3, background: dark ? '#333' : '#f0f0f0', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg', 'soccer-international', 'racing', 'tennis', 'wrestling', 'mma'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

export default function SetlistPage() {
  const { t } = useLang()
  const { dark } = useTheme()
  const [sets, setSets] = useState<CardSet[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeSport, setActiveSport] = useState<'nba' | 'nfl' | 'baseball' | 'hockey' | 'pokemon' | 'mtg' | 'soccer-international' | 'racing' | 'tennis' | 'wrestling' | 'mma'>('nba')
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [activeDecade, setActiveDecade] = useState<number | null>(null)
  const [searchSet, setSearchSet] = useState('')
  const [showOnlyOwned, setShowOnlyOwned] = useState(false)
  const [sortSets, setSortSets] = useState<'az' | 'pct_desc' | 'pct_asc'>('az')
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncDone, setSyncDone] = useState(false)
  const [newMatchCount, setNewMatchCount] = useState(0)
  const [totalSynced, setTotalSynced] = useState<number | null>(null)
  const [unmatchedCards, setUnmatchedCards] = useState<UnmatchedCard[]>([])
  const [showMissing, setShowMissing] = useState(false)
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualForm, setManualForm] = useState({ nom: '', annee: '', marque: '', collection: '', variation: '' })
  const [placingIdx, setPlacingIdx] = useState<number | null>(null)
  const [pendingPlace, setPendingPlace] = useState<{ cardIdx: number; entryId: number; setName: string; setId: number; setYear: number | null } | null>(null)
  const [gotoPickerIdx, setGotoPickerIdx] = useState<number | null>(null)
  const [gotoSetId, setGotoSetId] = useState<string>('')
  const [gotoAllSets, setGotoAllSets] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null)
      setAuthReady(true)
    })
  }, [])

  // Restaurer la liste des cartes non placées + total synced depuis le stockage local
  useEffect(() => {
    if (!userId) return
    setSyncDone(false); setUnmatchedCards([]); setTotalSynced(null); setNewMatchCount(0)
    try {
      const raw = localStorage.getItem(`setlist_unmatched_${activeSport}_${userId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.cards)) {
          setUnmatchedCards(parsed.cards)
          setSyncDone(true)
        }
      }
    } catch {}
    try {
      const stored = localStorage.getItem(`setlist_synced_total_${activeSport}_${userId}`)
      if (stored) setTotalSynced(Number(stored))
    } catch {}
  }, [userId, activeSport])

  const saveUnmatched = useCallback((cards: UnmatchedCard[]) => {
    if (!userId) return
    try {
      localStorage.setItem(`setlist_unmatched_${activeSport}_${userId}`, JSON.stringify({ cards, syncedAt: Date.now() }))
    } catch {}
  }, [userId, activeSport])

  const cardFingerprint = (c: Pick<UnmatchedCard, 'nom' | 'annee' | 'collection' | 'variation'>) =>
    `${c.nom}|${c.annee}|${c.collection}|${c.variation || ''}`

  const getDismissed = useCallback((): Set<string> => {
    if (!userId) return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(`setlist_dismissed_${activeSport}_${userId}`) || '[]')) } catch { return new Set() }
  }, [userId, activeSport])

  const saveDismissed = useCallback((s: Set<string>) => {
    if (!userId) return
    try { localStorage.setItem(`setlist_dismissed_${activeSport}_${userId}`, JSON.stringify([...s])) } catch {}
  }, [userId, activeSport])

  const dismissCard = useCallback(async (idx: number) => {
    const card = unmatchedCards[idx]
    const dismissed = getDismissed()
    dismissed.add(cardFingerprint(card))
    saveDismissed(dismissed)
    const updated = unmatchedCards.filter((_, i) => i !== idx)
    setUnmatchedCards(updated)
    saveUnmatched(updated)
    await fetchAndCacheSets(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmatchedCards, getDismissed, saveDismissed, saveUnmatched])

  const SETS_CACHE_KEY = userId ? `setlist_sets_v2_${activeSport}_${userId}` : null

  // Charge les sets depuis Supabase et met à jour le cache
  const fetchAndCacheSets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    const allRaw: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('card_sets')
        .select('id, tcdb_id, name, year, brand, sport, total_cards')
        .eq('sport', activeSport)
        .order('year', { ascending: false })
        .range(from, from + 999)
      if (!page?.length) break
      allRaw.push(...page)
      if (page.length < 1000) break
    }
    const setsData = allRaw.length ? allRaw : null
    if (!setsData) { if (!silent) setLoading(false); return }

    if (!userId) {
      const result = setsData.map(s => ({ ...s, owned: 0, pct: 0 }))
      setSets(result)
      const mostRecent = setsData[0]?.year
      if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
      if (!silent) setLoading(false)
      return
    }

    const allCompletions: { entry_id: number; manually_checked: boolean; card_set_entries: { set_id: number } | null }[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('user_set_completion')
        .select('entry_id, manually_checked, card_set_entries(set_id)')
        .eq('user_id', userId)
        .range(from, from + 999)
      if (!page?.length) break
      allCompletions.push(...(page as any))
      if (page.length < 1000) break
    }

    // Compter par set pour les barres de progression (toutes les coches)
    const countBySet = new Map<number, number>()
    allCompletions.forEach((c: any) => {
      const setId = c.card_set_entries?.set_id
      if (setId) countBySet.set(setId, (countBySet.get(setId) || 0) + 1)
    })


    const enriched = setsData.map(s => {
      const owned = countBySet.get(s.id) || 0
      const pct = s.total_cards > 0 ? Math.round((owned / s.total_cards) * 100) : 0
      return { ...s, owned, pct }
    })

    setSets(enriched)
    const mostRecent = setsData[0]?.year
    if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
    if (!silent) setLoading(false)

    // Mettre en cache pour la prochaine visite
    if (SETS_CACHE_KEY) {
      try { localStorage.setItem(SETS_CACHE_KEY, JSON.stringify({ sets: enriched, ts: Date.now() })) } catch {}
    }
  }, [userId, SETS_CACHE_KEY, activeSport])

  const loadSets = useCallback(async () => {
    // 1. Charger le cache instantanément si disponible
    if (SETS_CACHE_KEY) {
      try {
        const raw = localStorage.getItem(SETS_CACHE_KEY)
        if (raw) {
          const { sets: cached } = JSON.parse(raw)
          if (Array.isArray(cached) && cached.length) {
            setSets(cached)
            const mostRecent = cached.find((s: CardSet) => s.year)?.year
            if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
            setLoading(false)
            // Toujours rafraîchir silencieusement en arrière-plan : le cache sert juste
            // à afficher quelque chose instantanément, jamais à retarder la fraîcheur des
            // données (ex: une carte placée depuis Viewer3D doit se refléter immédiatement
            // au prochain passage sur /setlist, pas seulement après 5 minutes).
            fetchAndCacheSets(true)
            return
          }
        }
      } catch {}
    }
    // 2. Pas de cache → chargement normal
    await fetchAndCacheSets(false)
  }, [SETS_CACHE_KEY, fetchAndCacheSets])

  // Recharge quand l'auth est prête ou quand le sport change
  useEffect(() => { if (authReady) loadSets() }, [loadSets, authReady, activeSport])

  const syncAll = async () => {
    if (!userId) return
    setSyncing(true); setSyncProgress(0); setSyncDone(false)
    // Normalise les diacritiques avant suppression : Jokić→Jokic, Dončić→Doncic, Šarić→Saric…
    const stripD = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
    const norm = (s: string) => s ? stripD(s).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const words = (s: string) => s ? stripD(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2) : []

    // Sous-marques Panini/Topps : "Panini" doit matcher un set dont brand="Hoops", "Prizm", etc.
    const BRAND_PARENT: Record<string, string> = {
      hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini',
      optic: 'panini', mosaic: 'panini', chronicles: 'panini', contenders: 'panini',
      spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini',
      revolution: 'panini', eminence: 'panini', illusions: 'panini', nbahoops: 'panini',
      flagship: 'topps', finest: 'topps', bowman: 'topps',
    }
    const normBrand = (b: string) => { const n = norm(b); return BRAND_PARENT[n] ?? n }

    // Alias de noms de collection : "Flagship" ↔ "Topps Flagship" ↔ "Topps", "NBA Hoops" ↔ "Hoops"
    const COLL_ALIASES: Record<string, string[]> = {
      topps:        ['toppsflagship', 'flagship'],
      toppsflagship: ['topps', 'flagship'],
      flagship:     ['topps', 'toppsflagship'],
      nbahoops:     ['hoops'],
      hoops:        ['nbahoops'],
    }
    const collWords = (coll: string) => {
      const base = words(coll)
      const extra = COLL_ALIASES[norm(coll)] || []
      return [...new Set([...base, ...extra])]
    }

    // Mots trop génériques pour, seuls, désigner un produit précis (ex: "Panini" matche
    // aussi bien Prizm que Mosaic que Donruss…). Si après filtrage il ne reste aucun mot
    // spécifique, la carte est laissée non-matchée plutôt que placée au hasard dans l'un
    // des sets candidats — c'était la cause principale des placements "random".
    const GENERIC_WORDS = new Set([
      'panini', 'topps', 'upperdeck', 'upper', 'deck', 'nba', 'nfl', 'mlb', 'nhl',
      'basketball', 'football', 'baseball', 'hockey', 'cards', 'card', 'the', 'and',
    ])
    const specificWords = (uw: string[]) => uw.filter(w => !GENERIC_WORDS.has(w))

    // 1. Galerie (manuelles + CSV)
    const { data: gc } = await supabase.from('cartes_manuelles')
      .select('nom, annee, marque, collection, collection_tag, variation, card_number').eq('user_id', userId)
    let galleryCards: GalleryCard[] = (gc || []) as GalleryCard[]

    const { data: prof } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
    if (prof?.lien_csv) {
      try {
        const r = await fetch(prof.lien_csv + '&t=' + Date.now(), { signal: AbortSignal.timeout(8000) })
        const txt = await r.text()
        const csvCards = txt.split(/\r?\n/).slice(4).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0]?.includes('http')) return null
          return { nom: c[2]?.trim() || '', annee: c[4]?.trim() || '', marque: c[5]?.trim() || '', collection: c[6]?.trim() || '', collection_tag: '', variation: c[7]?.trim() || '', card_number: c[13]?.trim() || '' } as GalleryCard
        }).filter(Boolean) as GalleryCard[]
        galleryCards = [...galleryCards, ...csvCards]
      } catch {}
    }
    if (!galleryCards.length) { setSyncing(false); return }

    // Déduplication galerie : même joueur+année+collection+variation = même carte
    const gallerySeen = new Set<string>()
    galleryCards = galleryCards.filter(c => {
      const key = `${norm(c.nom)}|${c.annee}|${norm(c.collection || c.collection_tag || '')}|${norm(c.variation || '')}`
      if (gallerySeen.has(key)) return false
      gallerySeen.add(key)
      return true
    })

    // Charger uniquement les entrées MANUELLEMENT cochées (manually_checked = true)
    // → on respecte les choix explicites de l'utilisateur, les auto-matches seront recalculés
    const manualEntryIds = new Set<number>()
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase.from('user_set_completion')
        .select('entry_id').eq('user_id', userId).eq('manually_checked', true).range(from, from + 999)
      if (!page?.length) break
      page.forEach((r: any) => manualEntryIds.add(r.entry_id))
      if (page.length < 1000) break
    }
    setSyncProgress(10)

    // 2. Tous les sets (métadonnées) — paginé pour dépasser la limite max_rows=1000
    const allSetsData: { id: number; name: string; year: number | null; brand: string | null }[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase.from('card_sets').select('id, name, year, brand').eq('sport', activeSport).range(from, from + 999)
      if (!page?.length) break
      allSetsData.push(...page)
      if (page.length < 1000) break
    }
    const setsMap = new Map(allSetsData.map(s => [s.id, s]))
    setSyncProgress(15)

    // 3. Entrées pour nos joueurs (par chunks de 30 noms)
    const uniquePlayers = [...new Set(galleryCards.map(c => c.nom).filter(Boolean))]
    const allEntries: { id: number; player_name: string; variation: string | null; set_id: number; card_number: string | null }[] = []
    const PCHUNK = 30
    for (let ci = 0; ci < uniquePlayers.length; ci += PCHUNK) {
      setSyncProgress(15 + Math.round((ci / uniquePlayers.length) * 50))
      const batch = uniquePlayers.slice(ci, ci + PCHUNK)
      let from = 0
      for (;;) {
        const { data: page } = await supabase.from('card_set_entries')
          .select('id, player_name, variation, set_id, card_number').in('player_name', batch).range(from, from + 999)
        if (!page?.length) break
        allEntries.push(...page)
        if (page.length < 1000) break
        from += 1000
      }
    }
    setSyncProgress(65)

    setSyncProgress(75)

    // 5. Matching : UNE carte galerie → AU PLUS UNE entrée setlist (la plus précise)
    const matchedGalleryIdx = new Set<number>()
    const newRows: { user_id: string; entry_id: number; manually_checked: boolean }[] = []

    // Index des entrées par nom de joueur — UNIQUEMENT pour le sport actif
    // (les entrées d'autres sports sont ignorées pour éviter les faux positifs)
    const entriesByPlayer = new Map<string, typeof allEntries>()
    for (const e of allEntries) {
      if (!setsMap.has(e.set_id)) continue  // filtre sport : ignore les autres sports
      const key = norm(e.player_name)
      if (!entriesByPlayer.has(key)) entriesByPlayer.set(key, [])
      entriesByPlayer.get(key)!.push(e)
    }

    // Formats d'année acceptés pour une année de set Y
    const yearOk = (cy: string, y: number) => {
      if (!cy) return false
      const ys = String(y)
      return cy === ys
        || cy === `${y}-${String(y+1).slice(2)}`    // "2024-25"
        || cy === `${y-1}-${ys.slice(2)}`            // "2023-24" (saison précédente)
        || cy === `${y}-${y+1}`                      // "2024-2025"
        || cy === `${y-1}-${y}`                      // "2023-2024"
        || cy === `${String(y).slice(2)}-${String(y+1).slice(2)}`  // "24-25" (format court)
        || cy === `${String(y-1).slice(2)}-${ys.slice(2)}`         // "23-24" (format court prev)
    }

    for (let gi = 0; gi < galleryCards.length; gi++) {
      const card = galleryCards[gi]
      const coll = (card.collection || card.collection_tag || '').trim()
      if (!coll) continue  // collection obligatoire

      const playerEntriesAll = entriesByPlayer.get(norm(card.nom)) || []
      if (!playerEntriesAll.length) continue

      // Ne pas toucher les entrées déjà cochées manuellement pour ce joueur, mais laisser
      // la carte matcher d'AUTRES entrées disponibles du même joueur (année/produit différents)
      // — l'ancien comportement excluait TOUTES les cartes du joueur dès qu'une seule entrée
      // était cochée manuellement, faisant disparaître silencieusement les autres du sync.
      const playerEntries = playerEntriesAll.filter(e => !manualEntryIds.has(e.id))
      if (!playerEntries.length) { matchedGalleryIdx.add(gi); continue }

      const uw = collWords(coll)
      if (!uw.length) continue
      // Collection trop générique (ex: juste "Panini") pour désigner un produit précis
      // → on préfère laisser la carte non-matchée plutôt que deviner au hasard.
      if (!specificWords(uw).length) continue

      // Trouver toutes les entrées candidates pour cette carte
      const candidates: { entryId: number; extraWords: number }[] = []

      for (const e of playerEntries) {
        const set = setsMap.get(e.set_id)
        if (!set?.year) continue

        const cy = (card.annee || '').trim()
        if (!yearOk(cy, set.year)) continue

        // La collection doit matcher le nom du set
        if (!uw.some(w => norm(set.name).includes(w))) continue

        // Brand optionnel — avec résolution des sous-marques (Hoops→Panini, Flagship→Topps…)
        if (card.marque && set.brand) {
          const nb = normBrand(card.marque), ns = normBrand(set.brand)
          if (!nb.includes(ns) && !ns.includes(nb)) continue
        }

        // Variation : base↔base = parfait ; carte a variation mais entrée n'en a pas = match faible
        const cv = (card.variation || '').trim(), ev = (e.variation || '').trim()
        let varScore = 0
        if (!cv && !ev) {
          varScore = 0
        } else if (!cv && ev) {
          continue  // carte base ne peut pas matcher un insert
        } else if (cv && !ev) {
          varScore = 1  // insert dont la variation n'a pas été scrapée → match faible
        } else {
          const varOk = norm(cv).includes(norm(ev)) || norm(ev).includes(norm(cv)) || words(cv).some(w => norm(ev).includes(w))
          if (!varOk) continue
          varScore = 0
        }

        const sn = norm(set.name)
        const extraWords = words(set.name).filter(w => !uw.includes(w) && w.length > 3).length
        const missedWords = uw.filter(w => w.length > 3 && !sn.includes(w)).length
        const cn = (card.card_number || '').trim(), en = (e.card_number || '').trim()
        const cardNumBonus = cn && en && norm(cn) === norm(en) ? -1 : 0
        candidates.push({ entryId: e.id, extraWords: extraWords + missedWords + varScore + cardNumBonus })
      }

      if (!candidates.length) continue

      // Tie-break déterministe par entryId : sans ça, les entrées à égalité de score
      // étaient départagées par l'ordre de retour (non garanti) de la requête Supabase,
      // ce qui donnait l'impression d'un placement "random" à chaque nouveau sync.
      candidates.sort((a, b) => a.extraWords - b.extraWords || a.entryId - b.entryId)
      const best = candidates[0]
      // Ambiguïté persistante (plusieurs entrées à égalité parfaite malgré le filtrage
      // des mots génériques) → mieux vaut laisser non-matché que trancher au hasard.
      if (candidates.length > 1 && candidates[1].extraWords === best.extraWords) continue

      matchedGalleryIdx.add(gi)
      if (!best.entryId) continue
      newRows.push({ user_id: userId, entry_id: best.entryId, manually_checked: false })
    }
    setSyncProgress(88)

    // 6. Cartes galerie NON placées
    const yearMatchesSet = (cardYear: string, setYear: number | null) =>
      setYear ? yearOk((cardYear || '').trim(), setYear) : false

    const unmatched: UnmatchedCard[] = []
    for (let gi = 0; gi < galleryCards.length; gi++) {
      if (matchedGalleryIdx.has(gi)) continue
      const card = galleryCards[gi]
      const playerEntries = entriesByPlayer.get(norm(card.nom)) || []
      const coll = (card.collection || card.collection_tag || '').trim()
      const uw = collWords(coll)

      const bySet = new Map<number, { entryId: number; varMatch: boolean }>()
      for (const e of playerEntries) {
        const set = setsMap.get(e.set_id)
        if (!set) continue
        if (!yearMatchesSet(card.annee, set.year)) continue
        const cv = (card.variation || '').trim(), ev = (e.variation || '').trim()
        const varMatch = !cv ? !ev : !!ev && (norm(cv).includes(norm(ev)) || norm(ev).includes(norm(cv)) || words(cv).some(w => norm(ev).includes(w)))
        const prev = bySet.get(e.set_id)
        if (!prev || (varMatch && !prev.varMatch) || (!ev && !prev.varMatch)) {
          bySet.set(e.set_id, { entryId: e.id, varMatch })
        }
      }

      const candidates: SetCandidate[] = [...bySet.entries()].map(([setId, v]) => {
        const set = setsMap.get(setId)!
        return { setId, setName: set.name, setYear: set.year, entryId: v.entryId }
      })

      candidates.sort((a, b) => {
        const am = uw.some(w => norm(a.setName).includes(w)) ? 0 : 1
        const bm = uw.some(w => norm(b.setName).includes(w)) ? 0 : 1
        if (am !== bm) return am - bm
        return a.setName.localeCompare(b.setName)
      })

      unmatched.push({ ...card, candidates })
    }
    const dismissed = getDismissed()
    const filteredUnmatched = unmatched.filter(c => !dismissed.has(cardFingerprint(c)))
    setUnmatchedCards(filteredUnmatched)
    saveUnmatched(filteredUnmatched)

    // 7. Nettoyage des anciens auto-matches pour ce sport (évite l'accumulation)
    // On supprime tous les auto-matches (manually_checked=false) pour les entrées du sport actif
    // afin de repartir d'un état propre et éviter que plusieurs syncs s'accumulent.
    const currentSportEntryIds = allEntries.filter(e => setsMap.has(e.set_id)).map(e => e.id)
    for (let i = 0; i < currentSportEntryIds.length; i += 500) {
      await supabase.from('user_set_completion')
        .delete()
        .eq('user_id', userId)
        .eq('manually_checked', false)
        .in('entry_id', currentSportEntryIds.slice(i, i + 500))
    }

    // 8. Insertion des nouveaux matches
    for (let i = 0; i < newRows.length; i += 500)
      await supabase.from('user_set_completion').upsert(newRows.slice(i, i + 500), { onConflict: 'user_id,entry_id', ignoreDuplicates: true })

    const syncedTotal = matchedGalleryIdx.size
    setTotalSynced(syncedTotal)
    if (userId) {
      try { localStorage.setItem(`setlist_synced_total_${activeSport}_${userId}`, String(syncedTotal)) } catch {}
    }

    setSyncProgress(100)
    setNewMatchCount(newRows.length)
    setSyncDone(true)
    setSyncing(false)
    await fetchAndCacheSets(false)
  }

  // Placer manuellement une carte non placée dans un setlist choisi
  const placeCard = async (cardIdx: number, entryId: number) => {
    if (!userId) return
    setPlacingIdx(cardIdx)
    const { error } = await supabase.from('user_set_completion')
      .upsert({ user_id: userId, entry_id: entryId, manually_checked: true }, { onConflict: 'user_id,entry_id' })
    if (!error) {
      const updated = unmatchedCards.filter((_, i) => i !== cardIdx)
      setUnmatchedCards(updated)
      saveUnmatched(updated)
      await fetchAndCacheSets(false)
    }
    setPlacingIdx(null)
  }


  // Saisons disponibles (triées desc)
  const seasons = Array.from(new Set(sets.map(s => s.year).filter(Boolean) as number[])).sort((a, b) => b - a)
  const seasonSets = sets.filter(s => s.year === activeSeason).sort((a, b) => a.name.localeCompare(b.name))

  // Navigation par décennie
  const decades = Array.from(new Set(seasons.map(y => Math.floor(y / 10) * 10))).sort((a, b) => b - a)
  const resolvedDecade = activeDecade ?? (seasons.length ? Math.floor(seasons[0] / 10) * 10 : null)
  const decadeSeasons = resolvedDecade !== null ? seasons.filter(y => Math.floor(y / 10) * 10 === resolvedDecade) : []

  const totalOwned = seasonSets.reduce((acc, s) => acc + (s.owned || 0), 0)
  const totalCards = seasonSets.reduce((acc, s) => acc + s.total_cards, 0)
  const seasonPct = totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0
  const totalOwnedAllSets = sets.reduce((a, s) => a + (s.owned || 0), 0)
  const setsWithCards = sets.filter(s => (s.owned || 0) > 0).length

  const displayedSets = seasonSets
    .filter(s => {
      if (showOnlyOwned && !(s.owned && s.owned > 0)) return false
      if (searchSet && !s.name.toLowerCase().includes(searchSet.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortSets === 'pct_desc') return (b.pct || 0) - (a.pct || 0) || a.name.localeCompare(b.name)
      if (sortSets === 'pct_asc') return (a.pct || 0) - (b.pct || 0) || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })

  return (
    <>
    <style>{`
      .sl-container { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
      .sl-h1 { font-size: 32px; font-weight: 900; margin-bottom: 4px; }
      .sl-header-row { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
      .sl-sport-grid { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; width: 100%; }
      .sl-sport-btn { padding: 10px 8px; }
      .sl-sport-label { font-size: 14px; }
      .sl-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
      .sl-stats-box { min-width: 240px; }
      .sl-sets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
      @media (max-width: 767px) {
        .sl-container { padding: 20px 12px; }
        .sl-h1 { font-size: 24px; }
        .sl-header-row { flex-direction: column; }
        .sl-sport-grid { grid-template-columns: repeat(3, 1fr); }
        .sl-sport-btn { padding: 8px 4px; }
        .sl-sport-label { font-size: 12px; }
        .sl-actions { align-items: stretch; width: 100%; }
        .sl-stats-box { min-width: unset; }
        .sl-sets-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
      }
    `}</style>
    <div className="sl-container">
      <div style={{ marginBottom: 16 }}>
        <h1 className="sl-h1">Setlist</h1>
        <p style={{ color: '#888', fontSize: 15, marginBottom: 0 }}>{loading ? '...' : `${sets.length} ${t('setlist_collections_available')}`}</p>
      </div>

      <div className="sl-header-row">
        {/* Sélecteur de sport */}
        <div className="sl-sport-grid">
          {([ 'nba', 'nfl', 'baseball', 'hockey', 'soccer-international', 'racing', 'tennis', 'wrestling', 'mma', 'pokemon', 'mtg' ] as const).map(sp => {
            const accent = sp === 'nba' ? '#003DA6' : sp === 'nfl' ? '#1a5c1a' : sp === 'baseball' ? '#c0392b' : sp === 'hockey' ? '#1a3a5c' : sp === 'soccer-international' ? '#2d6a2d' : sp === 'racing' ? '#b85c00' : sp === 'tennis' ? '#5a8a00' : sp === 'wrestling' ? '#7a0000' : sp === 'mma' ? '#4a0050' : sp === 'pokemon' ? '#e6b800' : '#6b21a8'
            const label  = sp === 'nba' ? '🏀 NBA' : sp === 'nfl' ? '🏈 NFL' : sp === 'baseball' ? '⚾ Baseball' : sp === 'hockey' ? '🏒 Hockey' : sp === 'soccer-international' ? '⚽ Football' : sp === 'racing' ? '🏎️ Racing' : sp === 'tennis' ? '🎾 Tennis' : sp === 'wrestling' ? '🤼 Wrestling' : sp === 'mma' ? '🥊 MMA' : sp === 'pokemon' ? '🎴 Pokémon' : '🧙 MTG'
            const isActive = activeSport === sp
            return (
              <button key={sp} onClick={() => {
                if (isActive) return
                setActiveSport(sp)
                setActiveSeason(null)
                setActiveDecade(null)
                setSets([])
                setLoading(true)
                setSyncDone(false)
                setUnmatchedCards([])
                setTotalSynced(null)
                setNewMatchCount(0)
              }} className="sl-sport-btn" style={{
                borderRadius: 10, border: '2px solid',
                borderColor: isActive ? accent : (dark ? '#444' : '#e0e0e0'),
                background: isActive ? accent : (dark ? '#2a2a2a' : 'white'),
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%',
              }}>
                <span className="sl-sport-label" style={{ fontWeight: 800, color: isActive ? 'white' : (dark ? '#eee' : '#111'), whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {userId && (
          <div className="sl-actions">
            <button
              onClick={syncAll}
              disabled={syncing}
              style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: syncing ? '#ccc' : '#003DA6', color: syncing ? '#666' : 'white', fontWeight: 800, fontSize: 14, cursor: syncing ? 'default' : 'pointer' }}
            >
              {syncing ? `${t('setlist_syncing')} ${syncProgress}%` : t('setlist_sync_btn')}
            </button>
            {syncing && (
              <div style={{ height: 6, borderRadius: 3, background: dark ? '#333' : '#f0f0f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${syncProgress}%`, background: '#003DA6', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            )}
            {/* Stats toujours visibles dès que les sets sont chargés */}
            {!loading && (
              <div className="sl-stats-box" style={{ background: dark ? '#1a2440' : '#f0f4ff', borderRadius: 12, padding: '12px 18px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {syncDone && (
                  <div style={{ fontWeight: 800, color: '#2ecc71', marginBottom: 2 }}>
                    ✅ {newMatchCount} {t(newMatchCount !== 1 ? 'setlist_new_match_other' : 'setlist_new_match_one')}
                  </div>
                )}
                <div style={{ fontWeight: 700, color: '#003DA6' }}>
                  {(totalSynced ?? totalOwnedAllSets).toLocaleString()} {t('setlist_cards_synced')}
                </div>
                <div style={{ color: '#666', fontSize: 13 }}>
                  {t('setlist_in')} {setsWithCards} setlist{setsWithCards !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={async () => {
                    // Retire du localStorage les cartes déjà placées manuellement depuis la dernière synchro
                    if (userId && unmatchedCards.length > 0) {
                      const { data: placed } = await supabase
                        .from('user_set_completion')
                        .select('entry_id')
                        .eq('user_id', userId)
                      if (placed?.length) {
                        const placedIds = new Set(placed.map((r: any) => r.entry_id))
                        const stillUnmatched = unmatchedCards.filter(c =>
                          !c.candidates?.some((cd: any) => placedIds.has(cd.entryId))
                        )
                        if (stillUnmatched.length !== unmatchedCards.length) {
                          setUnmatchedCards(stillUnmatched)
                          saveUnmatched(stillUnmatched)
                        }
                      }
                    }
                    setShowMissing(true)
                  }}
                  style={{ marginTop: 4, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #003DA6', background: dark ? '#1e1e1e' : 'white', color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  {syncDone ? `${t('setlist_see_unplaced')} (${unmatchedCards.length})` : `${t('setlist_see_unplaced')} →`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal cartes galerie non placées */}
      {showMissing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowMissing(false)}
        >
          <div
            style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 18, padding: '28px 24px', maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>
                {t('setlist_unplaced_title')}
              </h2>
              <button onClick={() => setShowMissing(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>
            {!syncDone && unmatchedCards.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                {t('setlist_sync_first')}
              </div>
            ) : unmatchedCards.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#2ecc71', fontWeight: 700, padding: '30px 0', fontSize: 16 }}>
                {t('setlist_all_placed')}
              </div>
            ) : (
              <>
                <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                  {unmatchedCards.length} {t(unmatchedCards.length !== 1 ? 'setlist_cards_no_match' : 'setlist_card_no_match')}
                </p>
                {/* Ajout manuel d'une carte non trouvée */}
                <div style={{ marginBottom: 16 }}>
                  {!showAddManual ? (
                    <button
                      onClick={() => setShowAddManual(true)}
                      style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '1.5px dashed #ccc', background: dark ? '#2a2a2a' : 'white', color: '#888', cursor: 'pointer', width: '100%' }}
                    >
                      {t('setlist_add_manual')}
                    </button>
                  ) : (
                    <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {(['nom', 'annee', 'marque', 'collection', 'variation'] as const).map(f => (
                          <input
                            key={f}
                            placeholder={{ nom: t('setlist_player'), annee: t('setlist_year_ex'), marque: t('setlist_brand'), collection: 'Collection', variation: 'Variation' }[f]}
                            value={manualForm[f]}
                            onChange={e => setManualForm(p => ({ ...p, [f]: e.target.value }))}
                            style={{ fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #ddd', gridColumn: f === 'nom' ? '1 / -1' : undefined }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={!manualForm.nom.trim()}
                          onClick={() => {
                            const card: UnmatchedCard = { nom: manualForm.nom.trim(), annee: manualForm.annee.trim(), marque: manualForm.marque.trim(), collection: manualForm.collection.trim(), collection_tag: '', variation: manualForm.variation.trim(), candidates: [] }
                            const fp = cardFingerprint(card)
                            const dismissed = getDismissed()
                            dismissed.delete(fp)
                            saveDismissed(dismissed)
                            const updated = [card, ...unmatchedCards]
                            setUnmatchedCards(updated)
                            saveUnmatched(updated)
                            setManualForm({ nom: '', annee: '', marque: '', collection: '', variation: '' })
                            setShowAddManual(false)
                          }}
                          style={{ flex: 1, fontSize: 13, padding: '8px', borderRadius: 8, border: 'none', background: manualForm.nom.trim() ? '#003DA6' : '#ccc', color: 'white', fontWeight: 700, cursor: manualForm.nom.trim() ? 'pointer' : 'default' }}
                        >
                          {t('setlist_add')}
                        </button>
                        <button onClick={() => setShowAddManual(false)} style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', background: dark ? '#2a2a2a' : 'white', cursor: 'pointer', color: '#888' }}>{t('profile_cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
                {unmatchedCards.map((card, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                        {card.nom || '—'}
                        {card.variation && <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>{card.variation}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                        {[card.annee, card.marque, card.collection].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {placingIdx === i ? (
                      <span style={{ fontSize: 12, color: '#003DA6', fontWeight: 700 }}>{t('setlist_placing')}</span>
                    ) : pendingPlace?.cardIdx === i ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: dark ? '#1a2a1a' : '#f0fdf4', border: '1.5px solid #2ecc71', borderRadius: 10, padding: '10px 12px', maxWidth: 280 }}>
                        <div style={{ fontSize: 12, color: dark ? '#aaa' : '#555' }}>{t('setlist_will_be_placed_in')}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: dark ? '#fff' : '#111' }}>
                          {pendingPlace.setName}
                          {pendingPlace.setYear && <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>({pendingPlace.setYear})</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Link
                            href={`/setlist/${pendingPlace.setId}`}
                            target="_blank"
                            style={{ fontSize: 11, color: '#003DA6', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                          >
                            Voir le set →
                          </Link>
                          <button
                            onClick={() => { placeCard(pendingPlace.cardIdx, pendingPlace.entryId); setPendingPlace(null) }}
                            style={{ fontSize: 12, fontWeight: 700, color: 'white', background: '#2ecc71', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setPendingPlace(null)}
                            style={{ fontSize: 12, color: dark ? '#bbb' : '#555', background: dark ? '#333' : '#eee', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : card.candidates && card.candidates.length > 0 && gotoPickerIdx !== i ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          defaultValue=""
                          onChange={e => {
                            const v = Number(e.target.value)
                            if (v) {
                              const cand = card.candidates.find(c => c.entryId === v)
                              if (cand) setPendingPlace({ cardIdx: i, entryId: v, setName: cand.setName, setId: cand.setId, setYear: cand.setYear })
                            }
                          }}
                          style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #003DA6', color: '#003DA6', fontWeight: 600, background: dark ? '#1e1e1e' : 'white', cursor: 'pointer', maxWidth: 160 }}
                        >
                          <option value="">{t('setlist_place_in')} ({card.candidates.length})</option>
                          {card.candidates.map(c => (
                            <option key={c.entryId} value={c.entryId}>{c.setName}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setGotoPickerIdx(i); setGotoSetId('') }}
                          title={t('setlist_choose_set')}
                          style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #ccc', background: dark ? '#2a2a2a' : 'white', cursor: 'pointer', color: '#888', whiteSpace: 'nowrap' }}
                        >
                          {t('setlist_other')}
                        </button>
                        <button
                          onClick={() => dismissCard(i)}
                          title={t('setlist_mark_done')}
                          style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, background: '#f0fdf4', border: '1.5px solid #2ecc71', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : gotoPickerIdx === i ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          value={gotoSetId}
                          onChange={e => setGotoSetId(e.target.value)}
                          style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #888', maxWidth: 160 }}
                        >
                          <option value="">{t('setlist_choose_set')}</option>
                          {sets
                            .filter(s => gotoAllSets || !card.annee || String(s.year) === card.annee || `${s.year}-${String((s.year||0)+1).slice(2)}` === card.annee)
                            .sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name))
                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                          }
                        </select>
                        <button
                          onClick={() => { setGotoAllSets(v => !v); setGotoSetId('') }}
                          style={{ fontSize: 11, padding: '5px 7px', borderRadius: 6, border: '1px solid #ccc', background: gotoAllSets ? (dark ? '#333' : '#eee') : (dark ? '#2a2a2a' : 'white'), cursor: 'pointer', color: dark ? '#bbb' : '#666' }}
                        >
                          {gotoAllSets ? t('setlist_filtered') : t('setlist_all_sets')}
                        </button>
                        {gotoSetId && (
                          <Link href={`/setlist/${gotoSetId}`} onClick={() => setShowMissing(false)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, textDecoration: 'none' }}>
                            Voir →
                          </Link>
                        )}
                        <button onClick={() => setGotoPickerIdx(null)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #ccc', background: dark ? '#2a2a2a' : 'white', cursor: 'pointer', color: '#888' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => { setGotoPickerIdx(i); setGotoSetId('') }}
                          style={{ fontSize: 11, color: dark ? '#bbb' : '#555', fontWeight: 700, background: dark ? '#333' : '#f5f5f5', border: `1.5px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 6, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {t('setlist_see_set')}
                        </button>
                        <button
                          onClick={() => dismissCard(i)}
                          title={t('setlist_mark_done')}
                          style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, background: '#f0fdf4', border: '1.5px solid #2ecc71', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {t('setlist_done')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}


      {/* Coming soon si aucune collection */}
      {!loading && sets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: dark ? '#555' : '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: dark ? '#666' : '#aaa', marginBottom: 6 }}>Coming soon</div>
          <div style={{ fontSize: 14 }}>Les collections de cette catégorie arrivent bientôt.</div>
        </div>
      )}

      {/* Navigation décennie → saison */}
      {!loading && sets.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {/* Onglets décennie */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, borderBottom: `2px solid ${dark ? '#333' : '#f0f0f0'}`, paddingBottom: 0, overflowX: 'auto' }}>
            {decades.map(decade => {
              const isAct = resolvedDecade === decade
              const label = `${String(decade).slice(2)}s`
              return (
                <button
                  key={decade}
                  onClick={() => {
                    setActiveDecade(decade)
                    const first = seasons.find(y => Math.floor(y / 10) * 10 === decade)
                    if (first) setActiveSeason(first)
                  }}
                  style={{
                    padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: 800, fontSize: 16, color: isAct ? (dark ? '#5b8fff' : '#003DA6') : '#aaa',
                    borderBottom: isAct ? '3px solid #003DA6' : '3px solid transparent',
                    marginBottom: -2, transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Boutons d'années dans la décennie */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, overflowX: 'auto' }}>
            {decadeSeasons.map(year => {
              const isActive = activeSeason === year
              const ssets = sets.filter(s => s.year === year)
              const sOwned = ssets.reduce((a, s) => a + (s.owned || 0), 0)
              const sTotal = ssets.reduce((a, s) => a + s.total_cards, 0)
              const sPct = sTotal > 0 ? Math.round((sOwned / sTotal) * 100) : 0
              return (
                <button key={year} onClick={() => setActiveSeason(year)} style={{
                  padding: '10px 18px', borderRadius: 12, border: '2px solid',
                  borderColor: isActive ? '#003DA6' : (dark ? '#444' : '#e0e0e0'),
                  background: isActive ? '#003DA6' : (dark ? '#2a2a2a' : 'white'),
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  minWidth: 80,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? 'white' : (dark ? '#eee' : '#111') }}>
                    {seasonLabel(year, activeSport)}
                  </span>
                  <span style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.7)' : '#aaa', fontWeight: 600 }}>
                    {ssets.length} sets
                  </span>
                  {userId && sPct > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#7eb8ff' : '#003DA6' }}>
                      {sPct}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Header de la saison active */}
      {activeSeason && !loading && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 900, fontSize: 20, color: dark ? '#eee' : '#111' }}>{t('setlist_season')} {seasonLabel(activeSeason, activeSport)}</span>
            <span style={{ color: '#aaa', fontSize: 14, marginLeft: 10 }}>{seasonSets.length} collections · {totalCards.toLocaleString()} {t('setlist_cards')}</span>
          </div>
          {userId && totalCards > 0 && (
            <span style={{ fontWeight: 900, fontSize: 16, color: seasonPct === 100 ? '#2ecc71' : '#003DA6' }}>{seasonPct}% {t('setlist_completed')}</span>
          )}
        </div>
      )}

      {/* Recherche + filtre rapide */}
      {!loading && seasonSets.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <input
            value={searchSet}
            onChange={e => setSearchSet(e.target.value)}
            placeholder="Rechercher un set..."
            style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: `1.5px solid ${searchSet ? '#003DA6' : (dark ? '#444' : '#e0e0e0')}`, borderRadius: 10, fontSize: 14, background: dark ? '#2a2a2a' : 'white', color: dark ? '#eee' : '#111', outline: 'none' }}
          />
          {userId && setsWithCards > 0 && (
            <button
              onClick={() => setShowOnlyOwned(v => !v)}
              style={{ padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${showOnlyOwned ? '#003DA6' : (dark ? '#444' : '#e0e0e0')}`, background: showOnlyOwned ? '#003DA6' : (dark ? '#2a2a2a' : 'white'), color: showOnlyOwned ? 'white' : (dark ? '#bbb' : '#666'), fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ✦ Mes sets ({setsWithCards})
            </button>
          )}
          {userId && (
            <button
              onClick={() => setSortSets(s => s === 'az' ? 'pct_desc' : s === 'pct_desc' ? 'pct_asc' : 'az')}
              style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${sortSets !== 'az' ? '#003DA6' : (dark ? '#444' : '#e0e0e0')}`, background: sortSets !== 'az' ? '#003DA6' : (dark ? '#2a2a2a' : 'white'), color: sortSets !== 'az' ? 'white' : (dark ? '#bbb' : '#666'), fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {sortSets === 'az' ? 'A→Z' : sortSets === 'pct_desc' ? '% ↓' : '% ↑'}
            </button>
          )}
          {(searchSet || showOnlyOwned) && (
            <span style={{ fontSize: 13, color: '#aaa' }}>{displayedSets.length} résultat{displayedSets.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Grille des sets */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('setlist_loading')}</div>
      ) : sets.length === 0 ? null
      : seasonSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('setlist_no_collection')}</div>
      ) : displayedSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('setlist_no_match_search')}</div>
      ) : (
        <div className="sl-sets-grid">
          {displayedSets.map(set => (
            <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 14, padding: '18px 20px', border: `1.5px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`, cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s', height: '100%', boxSizing: 'border-box' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#003DA6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = dark ? '#2a2a2a' : '#f0f0f0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: dark ? '#eee' : '#111', lineHeight: 1.3, flex: 1, marginRight: 8 }}>
                    {set.name}
                  </div>
                  {set.pct !== undefined && set.pct > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 900, color: set.pct === 100 ? '#2ecc71' : '#003DA6', whiteSpace: 'nowrap' }}>
                      {set.pct}%
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {set.brand && (
                    <span style={{ fontSize: 11, color: dark ? '#7eb8ff' : '#003DA6', fontWeight: 700, background: dark ? '#1a2440' : '#f0f4ff', borderRadius: 4, padding: '2px 7px' }}>
                      {set.brand}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#aaa' }}>{set.total_cards.toLocaleString()} {t('setlist_cards')}</span>
                </div>
                {userId && (
                  <>
                    <CompletionBar pct={set.pct || 0} dark={dark} />
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {(set.owned || 0).toLocaleString()} / {set.total_cards.toLocaleString()} {t('setlist_owned')}
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
