'use client'
import { useRef, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { playerSlug, cardSlug } from '@/lib/playerSlug'
import { useTheme } from '@/lib/ThemeContext'
import CardVideoExport from '@/components/CardVideoExport'
import CardValueModule from '@/components/CardValueModule'
import SameCardCollectors from '@/components/SameCardCollectors'
import CollectionTagSelect from '@/components/CollectionTagSelect'
import CollectionMultiSelect from '@/components/CollectionMultiSelect'
import BookletViewer from '@/components/BookletViewer'
import ShareButton from '@/components/ShareButton'
import { getFormat } from '@/lib/cardFormats'
import { supabase } from '@/lib/supabase'

interface SetPlacementData {
  entry_id: number; set_id: number; set_name: string
  set_year: number | null; set_brand: string | null; set_sport: string
}

interface SetEntryRow {
  id: number; card_number: string | null; player_name: string
  variation: string | null; is_rc: boolean; image_url: string | null
}

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string; cert_number?: string
  auto: boolean; rc: boolean; patch: boolean; g: string; item_type?: string
  isManuelle?: boolean; id_manuelle?: string; collection_tag?: string; collections?: string[]; beckett_designation?: string
  booklet?: boolean; is_horizontal?: boolean; verso_is_horizontal?: boolean | null; format?: string; il?: string; ir?: string
  storage_binder?: string; storage_page?: number | null; storage_slot?: string;
  lien_vinted?: string; lien_ebay?: string;
}

// Le container .viewer-card a une forme fixe (déterminée par le recto, is_horizontal).
// Si le verso a une orientation différente (ex: recto vertical, verso à l'horizontale),
// on pré-pivote l'image du verso pour qu'elle remplisse quand même toute la boîte, comme
// pour la rotation des cartes horizontales dans les classeurs.
function backFaceImgStyle(boxIsHorizontal: boolean, backIsHorizontal: boolean): React.CSSProperties {
  const base: React.CSSProperties = { objectFit: 'cover', display: 'block' }
  if (boxIsHorizontal === backIsHorizontal) return { ...base, width: '100%', height: '100%' }
  // La boîte a un ratio W:H ; l'image doit être pré-pivotée dans une boîte à ratio inversé
  const swapped = boxIsHorizontal
    ? { width: '71.4286%', height: '140%' }   // boîte paysage → image portrait pivotée
    : { width: '140%', height: '71.4286%' }   // boîte portrait → image paysage pivotée
  return {
    ...base, ...swapped,
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
  }
}

export default function Viewer3D({ popup, accent, onClose, onNext, onPrev, getTags, userId, userSlug, isOwner, currentUserId, onCollectionTagChange, onCollectionsChange, allCollectionTags, onAddToMyGallery, initialAddState, onProposeTrade, cardValue, onValueSave, likeData, onLike }: {
  popup: Card
  accent: string
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  getTags: (d: Card) => React.ReactNode
  userId?: string
  userSlug?: string
  isOwner?: boolean
  currentUserId?: string
  onCollectionTagChange?: (card: Card, tag: string) => void
  onCollectionsChange?: (card: Card, next: string[]) => void
  allCollectionTags?: string[]
  onAddToMyGallery?: () => Promise<'added' | 'duplicate'>
  initialAddState?: 'idle' | 'added' | 'duplicate'
  onProposeTrade?: () => void
  cardValue?: number
  onValueSave?: (val: number | null) => void
  likeData?: { count: number; liked: boolean }
  onLike?: () => void
}) {
  const { dark } = useTheme()
  const bg = dark ? '#1a1a1a' : '#fff'
  const zoneBg = dark ? '#111' : '#f8f8f8'
  const infoBg = dark ? '#1a1a1a' : 'white'
  const textColor = dark ? '#eee' : '#111'
  const borderColor = dark ? '#2a2a2a' : '#eee'
  const metaColor = dark ? '#888' : '#999'

  const [tagInput, setTagInput] = useState(popup.collection_tag || '')
  const [tagSaving, setTagSaving] = useState(false)
  const [valeurInput, setValeurInput] = useState(cardValue != null ? String(cardValue) : '')
  useEffect(() => { setValeurInput(cardValue != null ? String(cardValue) : '') }, [popup.f, cardValue])

  const [inWishlist, setInWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  useEffect(() => {
    if (!currentUserId || isOwner) return
    setInWishlist(false)
    supabase.from('wishlist')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('nom', popup.n)
      .eq('annee', popup.y || '')
      .eq('marque', popup.br || '')
      .maybeSingle()
      .then(({ data }) => setInWishlist(!!data))
  }, [popup.f, currentUserId, isOwner])

  // ── Setlist placement ──────────────────────────────────────────────────────
  const placementCacheKey = (uid: string) =>
    `memo_sp_${uid}_${popup.id_manuelle ?? popup.f ?? popup.n ?? ''}`

  const [setPlacement, setSetPlacement] = useState<SetPlacementData | null | 'loading'>('loading')
  const [setPickerOpen, setSetPickerOpen] = useState(false)
  const [setPickerStep, setSetPickerStep] = useState<'search' | 'entries'>('search')
  const [setPickerSearch, setSetPickerSearch] = useState('')
  const [setPickerYear, setSetPickerYear] = useState('')
  const [setPickerResults, setSetPickerResults] = useState<{ id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }[]>([])
  const [setPickerSelectedSet, setSetPickerSelectedSet] = useState<{ id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number } | null>(null)
  const [setPickerEntries, setSetPickerEntries] = useState<SetEntryRow[]>([])
  const [setPickerEntrySearch, setSetPickerEntrySearch] = useState('')
  const [setPickerLoading, setSetPickerLoading] = useState(false)
  const [setPickerSaving, setSetPickerSaving] = useState<number | null>(null)
  const [setPickerSuggestions, setSetPickerSuggestions] = useState<{ id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }[]>([])
  const [setPickerEntryMatches, setSetPickerEntryMatches] = useState<SetEntryRow[]>([])
  const [setPickerEntryLoading, setSetPickerEntryLoading] = useState(false)
  const [setPickerVariations, setSetPickerVariations] = useState<string[]>([])
  const [setPickerOpenVars, setSetPickerOpenVars] = useState<Set<string>>(new Set(['Base']))
  const [setPickerError, setSetPickerError] = useState<string | null>(null)
  const [setPickerIsLargeSet, setSetPickerIsLargeSet] = useState(false)
  const setPickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setPickerEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!isOwner || !userId) { setSetPlacement(null); return () => { cancelled = true } }
    setSetPickerOpen(false)

    // Cache localStorage immédiat — évite tout lookup async fragile
    try {
      const cached = localStorage.getItem(placementCacheKey(userId))
      if (cached) {
        const parsed = JSON.parse(cached)
        // Marqueur négatif : l'utilisateur a explicitement retiré cette carte
        if (parsed?.removed) { setSetPlacement(null); return () => { cancelled = true } }
        setSetPlacement(parsed as SetPlacementData)
        return () => { cancelled = true }
      }
    } catch {}

    setSetPlacement('loading')

    const lookupViaCompletion = async () => {
      const { data: entries } = await supabase
        .from('card_set_entries').select('id, set_id, variation')
        .ilike('player_name', popup.n).limit(500)
      if (cancelled) return
      if (!entries?.length) { setSetPlacement(null); return }
      // chunk .in() queries to avoid URL length limits (max 200 IDs per batch)
      const allIds = entries.map(e => e.id)
      let completions: { entry_id: number }[] = []
      for (let i = 0; i < allIds.length; i += 200) {
        const { data: chunk } = await supabase
          .from('user_set_completion').select('entry_id')
          .eq('user_id', userId).in('entry_id', allIds.slice(i, i + 200))
        if (cancelled) return
        if (chunk?.length) completions = completions.concat(chunk as { entry_id: number }[])
      }
      if (cancelled) return
      if (!completions.length) { setSetPlacement(null); return }
      const completedIds = new Set(completions.map(c => c.entry_id))
      const matched = entries.filter(e => completedIds.has(e.id))
      if (!matched.length) { setSetPlacement(null); return }
      const setIds = [...new Set(matched.map(e => e.set_id))]
      const { data: sets } = await supabase.from('card_sets').select('id, name, year, brand, sport').in('id', setIds)
      if (cancelled) return
      if (!sets?.length) { setSetPlacement(null); return }
      const setMap = new Map(sets.map(s => [s.id, s]))
      const yearNum = popup.y ? parseInt(popup.y.slice(0, 4)) : null
      let best = matched[0]
      if (yearNum) {
        const ym = matched.find(e => { const s = setMap.get(e.set_id); return s && (s.year === yearNum || s.year === yearNum - 1) })
        if (ym) best = ym
      }
      const cs = setMap.get(best.set_id)
      if (!cs) { setSetPlacement(null); return }
      setSetPlacement({ entry_id: best.id, set_id: cs.id, set_name: cs.name, set_year: cs.year, set_brand: cs.brand, set_sport: cs.sport })
    }

    if (popup.id_manuelle) {
      ;(async () => {
        const { data } = await supabase.from('cartes_manuelles')
          .select('set_entry_id').eq('id', popup.id_manuelle).maybeSingle()
        if (cancelled) return
        if (data?.set_entry_id) {
          const eid = data.set_entry_id as number
          const { data: cse } = await supabase.from('card_set_entries').select('id, set_id').eq('id', eid).maybeSingle()
          if (cancelled) return
          if (!cse) { await lookupViaCompletion(); return }
          const { data: cs } = await supabase.from('card_sets').select('id, name, year, brand, sport').eq('id', cse.set_id).maybeSingle()
          if (cancelled) return
          if (!cs) { await lookupViaCompletion(); return }
          setSetPlacement({ entry_id: eid, set_id: cs.id, set_name: cs.name, set_year: cs.year, set_brand: cs.brand, set_sport: cs.sport })
        } else {
          await lookupViaCompletion()
        }
      })()
    } else {
      lookupViaCompletion()
    }

    return () => { cancelled = true }
  }, [popup.id_manuelle, popup.f, popup.n, isOwner, userId])

  const openPicker = async () => {
    setSetPickerOpen(true)
    setSetPickerStep('search')
    setSetPickerSearch('')
    setSetPickerYear(popup.y ? popup.y.slice(0, 4) : '')
    setSetPickerResults([])
    setSetPickerSuggestions([])
    setSetPickerSelectedSet(null)
    setSetPickerEntries([])
    setSetPickerEntryMatches([])
    setSetPickerEntrySearch('')
    setSetPickerError(null)

    // Suggestions auto basées sur brand + collection + année de la carte
    const yearNum = popup.y ? parseInt(popup.y.slice(0, 4)) : null
    const collName = popup.s?.trim()  // nom de la collection (ex: "Mosaic", "Select")
    const brandName = popup.br?.trim()
    if (yearNum || collName || brandName) {
      let q = supabase.from('card_sets').select('id, name, year, brand, sport, total_cards').limit(8)
      if (yearNum) q = q.or(`year.eq.${yearNum},year.eq.${yearNum - 1}`)
      if (collName && collName.length >= 3) q = q.ilike('name', `%${collName}%`)
      else if (brandName && brandName.length >= 2) q = q.ilike('brand', `%${brandName}%`)
      const { data } = await q.order('total_cards', { ascending: false })
      setSetPickerSuggestions(dedupSets(data || []))
    }
  }

  const sportEmoji = (sport: string) => {
    const s = (sport || '').toLowerCase()
    if (s.includes('basket') || s === 'nba') return '🏀'
    if (s.includes('baseball') || s === 'mlb') return '⚾'
    if (s.includes('football') || s === 'nfl') return '🏈'
    if (s.includes('hockey') || s === 'nhl') return '🏒'
    if (s.includes('soccer') || s.includes('foot') || s === 'mls') return '⚽'
    if (s.includes('tennis')) return '🎾'
    if (s.includes('mma') || s.includes('ufc')) return '🥊'
    if (s.includes('wrestling') || s.includes('wwe')) return '🤼'
    if (s.includes('racing') || s.includes('nascar') || s.includes('formula')) return '🏎️'
    if (s.includes('golf')) return '⛳'
    return null
  }

  const normSetKey = (s: { name: string; year: number | null }) => {
    // Garde le nom COMPLET (avec préfixe année) → "2021 Panini Mosaic" ≠ "2021-22 Panini Mosaic"
    // Seul le ratio de cartes (dans dedupSets) peut encore fusionner deux entrées
    const base = s.name.toLowerCase().replace(/\s+/g, ' ').trim()
    return `${s.year}_${base}`
  }

  // Dedup sets avec le même nom normalisé, SAUF si les counts de cartes diffèrent
  // significativement (>50%) → ce sont des sets genuinement différents
  const dedupSets = <T extends { name: string; year: number | null; total_cards: number }>(sets: T[]): T[] => {
    const seen = new Map<string, number>()
    return sets.filter(s => {
      const key = normSetKey(s)
      if (!seen.has(key)) { seen.set(key, s.total_cards); return true }
      const first = seen.get(key)!
      const ratio = Math.max(first, s.total_cards) / Math.max(Math.min(first, s.total_cards), 1)
      return ratio > 1.5
    })
  }

  const searchSets = async (q: string, year: string) => {
    if (q.trim().length < 2 && year.trim().length < 4) { setSetPickerResults([]); return }
    let qry = supabase.from('card_sets').select('id, name, year, brand, sport, total_cards').limit(20)
    if (year.trim().length >= 4) qry = qry.eq('year', parseInt(year))
    if (q.trim().length >= 2) qry = qry.ilike('name', `%${q.trim()}%`)
    const { data } = await qry.order('total_cards', { ascending: false })
    setSetPickerResults(dedupSets(data || []).slice(0, 12))
  }

  const LARGE_SET_THRESHOLD = 1500

  const selectSet = async (s: { id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }) => {
    setSetPickerSelectedSet(s)
    setSetPickerStep('entries')
    setSetPickerLoading(true)
    setSetPickerEntries([])
    setSetPickerEntryMatches([])
    setSetPickerEntrySearch('')
    setSetPickerError(null)
    const isLarge = s.total_cards > LARGE_SET_THRESHOLD
    setSetPickerIsLargeSet(isLarge)

    // Charger correspondances joueur (exact puis fuzzy)
    let matches: SetEntryRow[] = []
    const exactRes = await supabase.from('card_set_entries')
      .select('id, card_number, player_name, variation, is_rc, image_url')
      .eq('set_id', s.id).eq('player_name', popup.n).order('card_number').limit(50)
    matches = exactRes.data || []
    if (!matches.length) {
      const { data: fuzzy } = await supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', s.id).ilike('player_name', `%${popup.n}%`).order('card_number').limit(30)
      matches = fuzzy || []
    }

    const matchIds = new Set(matches.map(e => e.id))

    if (isLarge) {
      // Grand set : ne pas charger les 30k+ entrées, on se repose sur la recherche
      const varSet = new Set(matches.map(e => e.variation ?? 'Base'))
      const vars = ['Base', ...Array.from(varSet).filter(v => v !== 'Base').sort()]
      setSetPickerVariations(vars)
      setSetPickerOpenVars(new Set([matches[0]?.variation ?? 'Base']))
      setSetPickerEntryMatches(matches)
      setSetPickerEntries([])
    } else {
      const { data: allData } = await supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', s.id).order('variation, card_number').limit(1500)
      const allEntries = allData || []
      const rest = allEntries.filter(e => !matchIds.has(e.id))
      const varSet = new Set<string>()
      for (const e of allEntries) varSet.add(e.variation ?? 'Base')
      const vars = ['Base', ...Array.from(varSet).filter(v => v !== 'Base').sort()]
      const matchVar = matches[0]?.variation ?? 'Base'
      setSetPickerOpenVars(new Set([matchVar]))
      setSetPickerVariations(vars)
      setSetPickerEntryMatches(matches)
      setSetPickerEntries(rest)
    }

    setSetPickerLoading(false)
  }

  const searchEntries = async (q: string, setId: number) => {
    if (!q.trim() || q.trim().length < 2) { setSetPickerEntries([]); setSetPickerEntryLoading(false); return }
    setSetPickerEntryLoading(true)
    const tokens = q.trim().split(/\s+/).filter(t => t.length >= 2)
    let qry = supabase.from('card_set_entries')
      .select('id, card_number, player_name, variation, is_rc, image_url')
      .eq('set_id', setId)
    for (const token of tokens) {
      qry = qry.or(`player_name.ilike.%${token}%,card_number.ilike.%${token}%,variation.ilike.%${token}%`)
    }
    const { data } = await qry.order('card_number').limit(200)
    // Si multi-token ne trouve rien, fallback : juste le dernier token (nom de famille)
    if (!data?.length && tokens.length > 1) {
      const lastName = tokens[tokens.length - 1]
      const { data: fallback } = await supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', setId)
        .or(`player_name.ilike.%${lastName}%,variation.ilike.%${lastName}%`)
        .order('card_number').limit(200)
      setSetPickerEntries(fallback || [])
    } else {
      setSetPickerEntries(data || [])
    }
    setSetPickerEntryLoading(false)
  }

  const confirmEntry = async (entry: SetEntryRow) => {
    if (!userId || setPickerSaving !== null) return
    setSetPickerSaving(entry.id)
    setSetPickerError(null)

    if (popup.id_manuelle) {
      const { error: cmErr } = await supabase
        .from('cartes_manuelles').update({ set_entry_id: entry.id }).eq('id', popup.id_manuelle)
      if (cmErr) console.warn('[setlist] cartes_manuelles update error:', cmErr.message)
    }

    const { data: uscData, error: uscErr } = await supabase.from('user_set_completion').upsert(
      { user_id: userId, entry_id: entry.id, manually_checked: true, matched_card_key: popup.f || null },
      { onConflict: 'user_id,entry_id' }
    ).select('id')
    if (uscErr || !uscData?.length) {
      setSetPickerError(uscErr ? `Erreur DB: ${uscErr.message}` : 'Erreur: la sauvegarde a échoué (permissions?). Vérifie ta connexion.')
      setSetPickerSaving(null)
      return
    }

    const s = setPickerSelectedSet!
    const placement: SetPlacementData = { entry_id: entry.id, set_id: s.id, set_name: s.name, set_year: s.year, set_brand: s.brand, set_sport: s.sport }
    try { localStorage.setItem(placementCacheKey(userId), JSON.stringify(placement)) } catch {}
    setSetPlacement(placement)
    setSetPickerOpen(false)
    setSetPickerSaving(null)
  }

  const removeSetEntry = async () => {
    if (!userId || setPlacement === 'loading' || !setPlacement) return
    const entryId = setPlacement.entry_id
    if (popup.id_manuelle) {
      await supabase.from('cartes_manuelles').update({ set_entry_id: null }).eq('id', popup.id_manuelle)
    }
    const { error } = await supabase.from('user_set_completion').delete().eq('user_id', userId).eq('entry_id', entryId)
    if (error) { console.warn('[setlist] remove error:', error.message); return }
    // Marqueur négatif : court-circuite tout lookup DB sur F5 ou re-sync
    try { localStorage.setItem(placementCacheKey(userId), JSON.stringify({ removed: true })) } catch {}
    setSetPlacement(null)
  }

  const saveTag = async () => {
    if (!onCollectionTagChange) return
    setTagSaving(true)
    await onCollectionTagChange(popup, tagInput.trim())
    setTagSaving(false)
  }

  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(1)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const idleRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [showVideo, setShowVideo] = useState(false)

  const [slabMode, setSlabMode] = useState(false)
  const [flip90, setFlip90] = useState(false)
  const flip90Ref = useRef(false)
  // Format "slab" = photo réelle du slab entier (déjà recadrée aux proportions du boîtier)
  const cardFmt = getFormat(popup.format)
  const isSlabFmt = cardFmt.isSlab
  const [addState, setAddState] = useState<'idle' | 'loading' | 'added' | 'duplicate'>(initialAddState ?? 'idle')
  const [closeHover, setCloseHover] = useState(false)
  const { lang } = useLang()

  const isMemo = popup.item_type === 'memorabilia'

  // Parse grade: "PSA 9", "BGS 9.5", or just "9" / "10" → slab info
  const gradeInfo = (() => {
    if (isMemo) return null
    const g = popup.g?.trim()
    if (!g || g.toLowerCase() === 'raw') return null

    const psaLabels: Record<number, string> = { 10: 'GEM MT', 9: 'MINT', 8: 'NM-MT', 7: 'NM', 6: 'EX-MT', 5: 'EX', 4: 'VG-EX', 3: 'VG', 2: 'GOOD', 1: 'POOR' }
    const colors: Record<string, { top: string; text: string; accent: string }> = {
      PSA: { top: '#c8102e', text: '#fff', accent: '#e8c840' },
      BGS: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
      SGC: { top: '#006633', text: '#fff', accent: '#fff' },
      CGC: { top: '#003399', text: '#fff', accent: '#fff' },
      BVG: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
    }

    // "PSA 9", "BGS 9.5" etc.
    const withCompany = g.match(/^(PSA|BGS|SGC|CGC|BVG)\s*([\d.]+)$/i)
    if (withCompany) {
      const company = withCompany[1].toUpperCase()
      const num = parseFloat(withCompany[2])
      const bgsLabels: Record<number, string> = { 10: 'PRISTINE', 9.5: 'GEM MINT', 9: 'MINT PLUS', 8.5: 'NEAR MINT+', 8: 'NEAR MINT', 7: 'NEAR MINT', 6: 'EX-MT' }
      const sgcLabels: Record<number, string> = { 10: 'PRISTINE', 9.5: 'MINT+', 9: 'MINT', 8.5: 'NM-MT+', 8: 'NM-MT', 7.5: 'NM+', 7: 'NM' }
      const label = company === 'PSA' ? (psaLabels[num] || 'GRADED') : company === 'BGS' ? (bgsLabels[num] || 'GRADED') : company === 'SGC' ? (sgcLabels[num] || 'AUTHENTIC') : 'AUTHENTIC'
      return { company, grade: withCompany[2], label, color: colors[company] || colors.PSA }
    }

    // Just a number: "9", "10", "8.5"
    const numOnly = g.match(/^([\d.]+)$/)
    if (numOnly) {
      const num = parseFloat(numOnly[1])
      return { company: 'PSA', grade: numOnly[1], label: psaLabels[num] || 'GRADED', color: colors.PSA }
    }

    // Any non-raw value (e.g. "Graded", "Auth")
    return { company: 'GRADE', grade: g, label: 'CERTIFIED', color: colors.PSA }
  })()



  const applyTransform = useCallback(() => {
    if (cardRef.current) {
      const flip = flip90Ref.current ? ' rotateZ(90deg)' : ''
      cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)${flip}`
    }
    if (wrapRef.current) {
      wrapRef.current.style.transform = `scale(${scale.current})`
    }
  }, [])

  const toggleFlip90 = useCallback(() => {
    flip90Ref.current = !flip90Ref.current
    setFlip90(flip90Ref.current)
    applyTransform()
  }, [applyTransform])

  const reset = useCallback(() => {
    rotX.current = 0
    rotY.current = 0
    scale.current = 1
    applyTransform()
  }, [applyTransform])

  const pauseSlbAnim = useCallback(() => {
    idleRef.current?.style.setProperty('animation-play-state', 'paused')
  }, [])
  const resumeSlbAnim = useCallback(() => {
    setTimeout(() => idleRef.current?.style.setProperty('animation-play-state', 'running'), 500)
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
    pauseSlbAnim()
  }, [pauseSlbAnim])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    lastX.current = e.clientX
    lastY.current = e.clientY
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => { isDragging.current = false; resumeSlbAnim() }, [resumeSlbAnim])

  const onDoubleClick = useCallback(() => { reset() }, [reset])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001), 4)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeStartTime = useRef(0)
  const swipeAccumX = useRef(0)
  const slbWrapRef = useRef<HTMLDivElement>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) reset()
      lastTap.current = now
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      swipeStartTime.current = Date.now()
      swipeAccumX.current = 0
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }
    pauseSlbAnim()
  }, [reset, pauseSlbAnim])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touch1.current.x
      const dy = e.touches[0].clientY - touch1.current.y
      swipeAccumX.current += Math.abs(dx)
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      rotY.current += dx * 0.4
      rotX.current -= dy * 0.4
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      scale.current = Math.min(Math.max(0.5, scale.current * (dist / lastDist.current)), 4)
      lastDist.current = dist
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    }
  }, [applyTransform])

  const onTouchEnd = useCallback(() => {
    isDragging.current = false
    resumeSlbAnim()
    const dx = touch1.current.x - swipeStartX.current
    const dy = touch1.current.y - swipeStartY.current
    const dt = Date.now() - swipeStartTime.current
    // Quick straight horizontal swipe → navigate (skip if user was rotating back-and-forth)
    const netDx = Math.abs(dx)
    const accumX = swipeAccumX.current
    const isStraight = accumX > 0 && netDx / accumX > 0.55
    if (netDx > 100 && netDx > Math.abs(dy) * 2 && dt < 220 && isStraight) {
      if (dx < 0) onNext?.()
      else onPrev?.()
    }
  }, [onNext, onPrev, resumeSlbAnim])

  useEffect(() => {
    const prevent = (e: Event) => { if (isDragging.current) e.preventDefault() }
    document.addEventListener('selectstart', prevent)
    document.addEventListener('mouseup', () => { isDragging.current = false })
    return () => {
      document.removeEventListener('selectstart', prevent)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: bg, zIndex: 9999999,
      display: 'flex', overflow: 'hidden',
    }}>
      <style>{`
        .viewer-layout { display: flex; width: 100%; height: 100%; overflow: hidden; }
        .viewer-zone { flex: 1.2; position: relative; overflow: hidden; background: ${zoneBg}; display: flex; align-items: center; justify-content: center; perspective: 2000px; cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
        .viewer-info { flex: 0.8; padding: 30px; display: flex; flex-direction: column; justify-content: center; background: ${infoBg}; overflow-y: auto; color: ${textColor}; }
        .viewer-card { width: 560px; height: 784px; }
        .viewer-card--horizontal { width: min(784px, 54vw) !important; height: min(560px, 38.6vw) !important; }
        .viewer-card--slab { width: 478px !important; height: 784px !important; }
        @media (max-width: 1200px) { .viewer-card { width: 420px; height: 588px; } .viewer-card--horizontal { width: min(560px, 54vw) !important; height: min(400px, 38.6vw) !important; } .viewer-card--slab { width: 359px !important; height: 588px !important; } }
        @media (max-width: 600px) {
          .viewer-layout { flex-direction: column; }
          .viewer-zone { flex: 0 0 78% !important; width: 100% !important; min-height: 0; }
          .viewer-info { flex: 0 0 22% !important; width: 100% !important; min-height: 0; padding: 8px 14px !important; justify-content: flex-start !important; overflow-y: auto !important; }
          .viewer-info h2 { font-size: 1rem !important; margin: 2px 0 !important; }
          .viewer-card { width: min(300px, 72vw) !important; height: min(420px, 100.8vw) !important; }
          .viewer-card--horizontal { width: min(360px, 86vw) !important; height: min(257px, 61.4vw) !important; }
          .viewer-card--slab { width: min(256px, 61vw) !important; height: min(420px, 100.8vw) !important; }
          .viewer-hint { display: none !important; }
        }
      `}</style>
      <button
        onClick={onClose}
        onMouseEnter={() => setCloseHover(true)}
        onMouseLeave={() => setCloseHover(false)}
        style={{
          position: 'absolute', top: 10, right: 10, cursor: 'pointer', zIndex: 10001,
          background: closeHover ? '#003DA6' : (dark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)'),
          color: closeHover ? 'white' : textColor,
          border: closeHover ? '1px solid #003DA6' : `1px solid ${borderColor}`,
          borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: closeHover ? '0 14px' : '0',
          width: closeHover ? 'auto' : 32, height: 32,
          fontSize: closeHover ? 12 : 18, fontWeight: 800,
          whiteSpace: 'nowrap', transition: 'all 0.18s',
        }}
      >
        {closeHover ? 'Fermer cette Carte' : '×'}
      </button>

      <div className="viewer-layout">
        {popup.booklet ? (
          <div className="viewer-zone" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <BookletViewer
              frontCover={popup.f}
              backCover={popup.b}
              interiorLeft={popup.il}
              interiorRight={popup.ir}
              accent={accent}
            />
          </div>
        ) : (
        <div className="viewer-zone"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Slab mode toggle — masqué pour le format "slab" (la photo est déjà le boîtier réel) */}
          {gradeInfo && !isSlabFmt && (
            <button onClick={(e) => { e.stopPropagation(); setSlabMode(s => !s) }} style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              background: slabMode ? gradeInfo.color.top : 'rgba(0,0,0,0.45)',
              color: 'white', border: 'none', borderRadius: 20, padding: '6px 14px',
              fontWeight: 800, fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: '0.2s',
            }}>
              {slabMode ? '🃏 Carte seule' : `🏅 Slab ${gradeInfo.company}`}
            </button>
          )}
          {gradeInfo && !slabMode && !isSlabFmt && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 10,
              background: gradeInfo.color.top, color: gradeInfo.color.text,
              borderRadius: 6, padding: '4px 10px',
              fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12,
              letterSpacing: '0.5px', pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {gradeInfo.company} {gradeInfo.grade}
            </div>
          )}

          <style>{`.card-idle { transform-style: preserve-3d; }`}</style>
          <div ref={wrapRef} style={{ willChange: 'transform' }}>
            <div ref={idleRef} className="card-idle">
            {slabMode && gradeInfo ? (
              /* ── SLAB VIEW ── */
              (() => {
                const isPSA = gradeInfo.company === 'PSA' || gradeInfo.company === 'GRADE'
                const isBGS = gradeInfo.company === 'BGS' || gradeInfo.company === 'BVG'
                const isSGC = gradeInfo.company === 'SGC'
                const isCGC = gradeInfo.company === 'CGC'
                // Vrai numéro de certification s'il est renseigné, sinon numéro synthétique (visuel)
                const certSeed = (popup.n + popup.y + popup.s).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const certNum = popup.cert_number?.trim() || String((certSeed * 7919 + 10000000) % 90000000 + 10000000).slice(0, 8)
                const setLine = [popup.y, popup.br, popup.s].filter(Boolean).join(' ').toUpperCase()

                return (
                  <div ref={cardRef} style={{ position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform' }}>
                    {/* D = 18px slab depth */}
                    <style>{`
                      /* ── 3D WRAPPER (no overflow:hidden — would flatten 3D) ── */
                      .slb-wrap {
                        position: relative;
                        transform-style: preserve-3d;
                        width: 252px;
                      }
                      @media(max-width:1200px){.slb-wrap{width:214px;}}
                      @media(max-width:600px){.slb-wrap{width:162px;}}
                      @media(max-width:600px){
                        .psa2 { border-width: 3px; }
                        .psa2-main { padding: 3px 6px 2px; }
                        .psa2-set  { font-size: 5.5px; }
                        .psa2-name { font-size: 8px; }
                        .psa2-gname{ font-size: 7px; }
                        .psa2-gnum { font-size: 20px; }
                        .psa2-cert { font-size: 6px; }
                        .psa2-bot  { padding: 1px 6px 3px; }
                        .psa2-bc   { font-size: 12px; letter-spacing: -2.5px; }
                        .psa2-logo-p, .psa2-logo-sa { font-size: 8px; }
                        .psa2-logo-box { padding: 1px 4px; }
                        .bgs2-b    { font-size: 18px; }
                        .bgs2-side { width: 22px; }
                        .bgs2-name { font-size: 8px; }
                        .bgs2-gnum { font-size: 24px; }
                      }

                      /* ── FRONT FACE — clear acrylic ── */
                      .slb-front {
                        position: relative;
                        transform: translateZ(18px);
                        transform-style: preserve-3d;
                        border-radius: 6px;
                        overflow: hidden;
                        /* Clear acrylic — barely tinted transparent */
                        background: linear-gradient(158deg,
                          rgba(232,244,255,0.46) 0%,
                          rgba(214,230,254,0.28) 38%,
                          rgba(224,237,255,0.38) 68%,
                          rgba(212,228,252,0.30) 100%
                        );
                        /* Front face: bright edge highlight + soft natural shadow */
                        box-shadow:
                          0 0 0 1px rgba(255,255,255,0.92),
                          0 6px 14px rgba(0,0,0,0.14),
                          0 14px 36px rgba(0,0,0,0.12),
                          0 28px 60px rgba(0,0,0,0.09),
                          0 50px 90px rgba(0,0,0,0.06),
                          inset 0  1px 0 rgba(255,255,255,0.72),
                          inset 1px 0  0 rgba(255,255,255,0.42),
                          inset -1px 0  0 rgba(0,0,0,0.08),
                          inset 0 -1px 0 rgba(0,0,0,0.14);
                        backdrop-filter: blur(4px);
                      }
                      /* Diagonal gloss — simulates polished acrylic surface */
                      .slb-front::before {
                        content: ''; position: absolute; inset: 0; z-index: 3;
                        pointer-events: none; border-radius: 6px;
                        background: linear-gradient(116deg,
                          rgba(255,255,255,0.24) 0%,
                          rgba(255,255,255,0.10) 22%,
                          rgba(255,255,255,0.02) 44%,
                          transparent 58%,
                          rgba(255,255,255,0.04) 80%
                        );
                      }

                      /* ── PLASTIC ZONES on front face ── */
                      .slb-top { padding: 6px 13px 6px; position: relative; z-index: 1; }
                      .slb-mid { padding: 0 15px; position: relative; z-index: 1; }
                      .slb-bot {
                        padding: 11px 15px 15px; position: relative; z-index: 1;
                        display: flex; flex-direction: column; align-items: center; gap: 7px;
                      }

                      /* ── CARD WINDOW — deeply recessed ── */
                      .slb-window {
                        position: relative; overflow: hidden; border-radius: 2px;
                        box-shadow:
                          0 0 0 1px rgba(0,0,0,0.90),
                          inset 0 5px 16px rgba(0,0,0,0.85),
                          inset 4px 0 12px rgba(0,0,0,0.55),
                          inset -4px 0 12px rgba(0,0,0,0.55),
                          inset 0 -5px 14px rgba(0,0,0,0.60);
                      }
                      .slb-window img { display: block; width: 100%; aspect-ratio: 5/7; object-fit: cover; }
                      .slb-sheen {
                        position: absolute; inset: 0; pointer-events: none;
                        background: linear-gradient(to bottom, rgba(255,255,255,0.07) 0%, transparent 20%);
                      }

                      /* ── GOLD ACCENT ── */
                      .slb-gold {
                        width: 65%; height: 1.5px;
                        background: linear-gradient(to right, transparent, rgba(218,178,50,0.70), rgba(242,202,62,1), rgba(218,178,50,0.70), transparent);
                      }
                      .slb-dots { display: flex; gap: 5px; align-items: center; }
                      .slb-dot  { width: 4px; height: 4px; border-radius: 50%; background: rgba(215,170,45,0.50); }

                      /* ── 3D SIDE PANELS (visible when rotating) ── */
                      /* Left — rotates around left edge, goes from z=0 to z=18 */
                      .slb-el {
                        position: absolute; left: 0; top: 0; bottom: 0; width: 18px;
                        transform-origin: left center;
                        transform: rotateY(-90deg);
                        background: linear-gradient(to left,
                          rgba(175,202,235,0.90) 0%,
                          rgba(210,230,252,0.95) 55%,
                          rgba(238,248,255,0.98) 100%
                        );
                      }
                      /* Right */
                      .slb-er {
                        position: absolute; right: 0; top: 0; bottom: 0; width: 18px;
                        transform-origin: right center;
                        transform: rotateY(90deg);
                        background: linear-gradient(to right,
                          rgba(175,202,235,0.90) 0%,
                          rgba(210,230,252,0.95) 55%,
                          rgba(238,248,255,0.98) 100%
                        );
                      }
                      /* Top */
                      .slb-et {
                        position: absolute; left: 0; right: 0; top: 0; height: 18px;
                        transform-origin: top center;
                        transform: rotateX(90deg);
                        background: linear-gradient(to top,
                          rgba(175,202,235,0.90) 0%,
                          rgba(235,246,255,0.98) 100%
                        );
                      }
                      /* Bottom */
                      .slb-eb {
                        position: absolute; left: 0; right: 0; bottom: 0; height: 18px;
                        transform-origin: bottom center;
                        transform: rotateX(-90deg);
                        background: linear-gradient(to bottom,
                          rgba(175,202,235,0.90) 0%,
                          rgba(235,246,255,0.98) 100%
                        );
                      }

                      /* ── GRADING INSERTS — paper labels, no plastic effect ── */

                      /* ── PSA — cadre rouge épais sur fond blanc, grade énorme ── */
                      /* ── PSA — cadre rouge épais, fond blanc, proportions slab réel ── */
                      .psa2 {
                        border: 5px solid #cc1122;
                        border-radius: 2px; overflow: hidden;
                        background: #fff;
                        font-family: Arial, Helvetica, sans-serif;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.25);
                      }
                      .psa2-main {
                        padding: 5px 9px 3px;
                        display: flex; gap: 5px; align-items: flex-start;
                      }
                      .psa2-left {
                        flex: 1; min-width: 0;
                        display: flex; flex-direction: column; gap: 1px;
                      }
                      .psa2-set  { font-size: 7.5px; font-weight: 400; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
                      .psa2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
                      .psa2-var  { font-size: 7px; color: #444; text-transform: uppercase; line-height: 1.3; }
                      .psa2-right {
                        display: flex; flex-direction: column;
                        align-items: flex-end; flex-shrink: 0;
                      }
                      .psa2-gname { font-size: 10px; font-weight: 800; color: #111; letter-spacing: 0.3px; line-height: 1.2; }
                      .psa2-gnum  { font-size: 30px; font-weight: 900; color: #111; line-height: 0.95; letter-spacing: -1px; }
                      .psa2-cert  { font-size: 8px; font-weight: 600; color: #111; letter-spacing: 0.3px; line-height: 1.3; }
                      .psa2-bot {
                        display: flex; align-items: center;
                        padding: 1px 9px 5px; gap: 6px;
                      }
                      .psa2-bc {
                        flex: 1; font-family: monospace;
                        font-size: 18px; letter-spacing: -3.5px;
                        color: #111; line-height: 1; overflow: hidden;
                      }
                      .psa2-logo-box {
                        background: linear-gradient(145deg, #ddd, #c4c4c4);
                        border: 0.5px solid #aaa; border-radius: 2px;
                        padding: 2px 5px; flex-shrink: 0;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.15);
                      }
                      .psa2-logo-p  { font-size: 11px; font-weight: 900; font-style: italic; color: #cc1122; }
                      .psa2-logo-sa { font-size: 11px; font-weight: 900; font-style: italic; color: #003DA6; }

                      /* ── BGS / BECKETT (crème, bande noire B à gauche, note sur droite) ── */
                      .bgs2 {
                        background: #f2eed8;
                        border-radius: 3px; overflow: hidden;
                        font-family: Arial, sans-serif;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15);
                        display: flex; min-height: 60px;
                        border: 0.5px solid #d8cf9a;
                      }
                      .bgs2-side { width: 34px; background: #111; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                      .bgs2-b    { font-size: 26px; font-weight: 900; color: #d4a820; font-style: italic; line-height: 1; }
                      .bgs2-body { flex: 1; padding: 5px 8px; display: flex; align-items: stretch; gap: 5px; min-width: 0; }
                      .bgs2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
                      .bgs2-set  { font-size: 7px; font-weight: 700; color: #666; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.3px; }
                      .bgs2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                      .bgs2-sub  { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 6px; }
                      .bgs2-sub-item { font-size: 6.5px; color: #666; font-style: italic; font-weight: 600; text-transform: uppercase; }
                      .bgs2-cert { font-size: 6.5px; color: #999; font-weight: 700; letter-spacing: 0.3px; }
                      .bgs2-grade {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        flex-shrink: 0; padding: 0 6px; border-left: 1px solid #c8b96a;
                        min-width: 52px;
                      }
                      .bgs2-gnum  { font-size: 36px; font-weight: 900; color: #111; line-height: 1; }
                      .bgs2-gname { font-size: 6.5px; font-weight: 800; color: #555; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; margin-top: 2px; }

                      /* ── SGC ── */
                      .sgc2 { background: #fafafa; border-radius: 3px; overflow: hidden; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15); display: flex; min-height: 60px; }
                      .sgc2-side { width: 26px; background: #006633; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                      .sgc2-txt  { font-size: 9px; font-weight: 900; color: #fff; letter-spacing: 1px; writing-mode: vertical-rl; transform: rotate(180deg); }
                      .sgc2-body { flex: 1; padding: 5px 8px; display: flex; align-items: center; gap: 5px; min-width: 0; }
                      .sgc2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 2px; }
                      .sgc2-set  { font-size: 7.5px; font-weight: 700; color: #444; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .sgc2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.3px; }
                      .sgc2-var  { font-size: 7px; color: #666; text-transform: uppercase; }
                      .sgc2-cert { font-size: 7px; color: #bbb; font-weight: 700; }
                      .sgc2-gbox { background: #006633; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 10px; flex-shrink: 0; min-width: 50px; }
                      .sgc2-gnum { font-size: 34px; font-weight: 900; color: #fff; line-height: 1; }
                      .sgc2-gname{ font-size: 6.5px; font-weight: 800; color: rgba(255,255,255,0.85); text-transform: uppercase; margin-top: 2px; }

                      /* ── CGC ── */
                      .cgc2 { background: #fff; border-radius: 3px; overflow: hidden; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15); }
                      .cgc2-top  { background: #0039a6; padding: 4px 10px; display: flex; justify-content: space-between; align-items: center; min-height: 28px; }
                      .cgc2-brand{ font-size: 14px; font-weight: 900; color: #fff; letter-spacing: 2px; }
                      .cgc2-gnum { font-size: 24px; font-weight: 900; color: #fff; line-height: 1; }
                      .cgc2-body { padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; gap: 4px; min-height: 32px; }
                      .cgc2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                      .cgc2-set  { font-size: 7.5px; font-weight: 700; color: #444; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .cgc2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .cgc2-var  { font-size: 7px; color: #666; text-transform: uppercase; }
                      .cgc2-right{ display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
                      .cgc2-gname{ font-size: 8px; font-weight: 800; color: #0039a6; }
                      .cgc2-cert { font-size: 6.5px; color: #bbb; font-weight: 700; }
                    `}</style>

                    <div ref={slbWrapRef} className="slb-wrap">
                      {/* ── FRONT FACE ── */}
                      <div className="slb-front">
                        {/* Label zone — plastic top */}
                        <div className="slb-top">
                          {isPSA && (
                            <div className="psa2">
                              <div className="psa2-main">
                                <div className="psa2-left">
                                  <span className="psa2-set">{setLine}</span>
                                  <span className="psa2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="psa2-var">{popup.v.toUpperCase()}</span>}
                                </div>
                                <div className="psa2-right">
                                  <span className="psa2-gname">{gradeInfo.label}</span>
                                  <span className="psa2-gnum">{gradeInfo.grade}</span>
                                  <span className="psa2-cert">{certNum}</span>
                                </div>
                              </div>
                              <div className="psa2-bot">
                                <span className="psa2-bc">{'|||||||||||||||||||||||||||||||'}</span>
                                <div className="psa2-logo-box">
                                  <span className="psa2-logo-p">P</span><span className="psa2-logo-sa">SA</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isBGS && (
                            <div className="bgs2">
                              <div className="bgs2-side"><span className="bgs2-b">B</span></div>
                              <div className="bgs2-body">
                                <div className="bgs2-info">
                                  <span className="bgs2-set">{setLine}</span>
                                  <span className="bgs2-name">{popup.n.toUpperCase()}</span>
                                  <div className="bgs2-sub">
                                    <span className="bgs2-sub-item">CENTERING —</span>
                                    <span className="bgs2-sub-item">CORNERS —</span>
                                    <span className="bgs2-sub-item">EDGES —</span>
                                    <span className="bgs2-sub-item">SURFACE —</span>
                                  </div>
                                  <span className="bgs2-cert">{certNum}</span>
                                </div>
                                <div className="bgs2-grade">
                                  <span className="bgs2-gnum">{gradeInfo.grade}</span>
                                  <span className="bgs2-gname">{gradeInfo.label}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isSGC && (
                            <div className="sgc2">
                              <div className="sgc2-side"><span className="sgc2-txt">SGC</span></div>
                              <div className="sgc2-body">
                                <div className="sgc2-info">
                                  <span className="sgc2-set">{setLine}</span>
                                  <span className="sgc2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="sgc2-var">{popup.v.toUpperCase()}</span>}
                                  <span className="sgc2-cert">{certNum}</span>
                                </div>
                                <div className="sgc2-gbox">
                                  <span className="sgc2-gnum">{gradeInfo.grade}</span>
                                  <span className="sgc2-gname">{gradeInfo.label}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isCGC && (
                            <div className="cgc2">
                              <div className="cgc2-top">
                                <span className="cgc2-brand">CGC</span>
                                <span className="cgc2-gnum">{gradeInfo.grade}</span>
                              </div>
                              <div className="cgc2-body">
                                <div className="cgc2-info">
                                  <span className="cgc2-set">{setLine}</span>
                                  <span className="cgc2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="cgc2-var">{popup.v.toUpperCase()}</span>}
                                </div>
                                <div className="cgc2-right">
                                  <span className="cgc2-gname">{gradeInfo.label}</span>
                                  <span className="cgc2-cert">{certNum}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card window */}
                        <div className="slb-mid">
                          <div className="slb-window">
                            <img src={popup.f} draggable={false} alt={popup.n} />
                            <div className="slb-sheen" />
                          </div>
                        </div>

                        {/* Bottom plastic + gold accent */}
                        <div className="slb-bot">
                          <div className="slb-gold" />
                          <div className="slb-dots">
                            <div className="slb-dot" />
                            <div className="slb-dot" style={{opacity:0.65,width:'3px',height:'3px'}} />
                            <div className="slb-dot" style={{opacity:0.38,width:'2.5px',height:'2.5px'}} />
                          </div>
                        </div>
                      </div>

                      {/* ── 3D SIDE PANELS — acrylic edges visible when rotating ── */}
                      <div className="slb-el" />
                      <div className="slb-er" />
                      <div className="slb-et" />
                      <div className="slb-eb" />
                    </div>
                  </div>
                )
              })()
            ) : (
              /* ── CARD VIEW (original) ── */
              /* Le format "slab" est plus épais : demi-profondeur devant/derrière + 4 tranches acryliques */
              (() => {
                const half = isSlabFmt ? 11 : 0 // demi-épaisseur (px) — slab ≈ 22px d'épaisseur totale
                const edge = isSlabFmt ? (
                  <>
                    {/* Tranches translucides (visibles à la rotation) */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: half * 2, transformOrigin: 'left center', transform: 'rotateY(-90deg)', background: 'linear-gradient(to left, rgba(175,202,235,0.85), rgba(238,248,255,0.97))' }} />
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: half * 2, transformOrigin: 'right center', transform: 'rotateY(90deg)', background: 'linear-gradient(to right, rgba(175,202,235,0.85), rgba(238,248,255,0.97))' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: half * 2, transformOrigin: 'top center', transform: 'rotateX(90deg)', background: 'linear-gradient(to top, rgba(175,202,235,0.85), rgba(238,248,255,0.97))' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: half * 2, transformOrigin: 'bottom center', transform: 'rotateX(-90deg)', background: 'linear-gradient(to bottom, rgba(175,202,235,0.85), rgba(238,248,255,0.97))' }} />
                  </>
                ) : null
                return (
              <div ref={cardRef} className={`viewer-card${popup.is_horizontal ? ' viewer-card--horizontal' : isSlabFmt ? ' viewer-card--slab' : ''}`} style={{
                position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform',
              }}>
                {edge}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', transform: half ? `translateZ(${half}px)` : undefined }}>
                  <img src={popup.f} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={popup.n} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: `rotateY(180deg)${half ? ` translateZ(${half}px)` : ''}`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <img src={popup.b} draggable={false} style={backFaceImgStyle(!!popup.is_horizontal, popup.verso_is_horizontal ?? !!popup.is_horizontal)} alt={popup.n} />
                </div>
              </div>
                )
              })()
            )}
            </div>{/* /card-idle */}
          </div>
          <p className="viewer-hint" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Glisser · Scroll pour zoomer · Double-clic pour reset
          </p>
        </div>
        )}

        <div className="viewer-info">
          <div style={{ color: accent, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>{popup.t}</div>
          <Link href={`/joueur/${playerSlug(popup.n)}`} style={{ textDecoration: 'none', color: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.querySelector('h2')!.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.querySelector('h2')!.style.textDecoration = 'none')}
          >
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '3px 0', cursor: 'pointer' }}>{popup.n}</h2>
          </Link>
          <div style={{ fontSize: '0.9rem', color: accent, fontWeight: 700, marginBottom: 4, fontStyle: 'italic' }}>{popup.v}</div>
          {popup.isManuelle && (popup.beckett_designation || popup.y || popup.br || popup.s) && (
            <div style={{ fontSize: 11, color: metaColor, marginBottom: 8, lineHeight: 1.4 }}>
              {popup.beckett_designation ||
                [popup.y, popup.br, popup.s, popup.v, popup.card_number ? `#${popup.card_number}` : '', popup.n].filter(Boolean).join(' ')}
            </div>
          )}
          {getTags(popup)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: `1px solid ${borderColor}`, marginTop: 10, paddingTop: 10 }}>
            {[
              ['Année', popup.y],
              ['Numérotation', popup.num || 'N/A'],
              [isMemo ? 'Taille' : 'Grade', isMemo ? (popup.g || '—') : popup.g],
              ['Collection', `${popup.br} ${popup.s}`],
            ].map(([l, v]) => (
              <div key={l}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>{l}</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{v}</span>
              </div>
            ))}
            {isMemo && popup.v?.trim() && (
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>Variation</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{popup.v}</span>
              </div>
            )}
            {isMemo && popup.cert_number?.trim() && (
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>✍️ Signé par</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{popup.cert_number}</span>
              </div>
            )}
            {isMemo && popup.card_number?.trim() && (
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>🏷️ Patch</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{popup.card_number}</span>
              </div>
            )}
          </div>

          {/* Localisation physique */}
          {popup.isManuelle && popup.storage_binder && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: metaColor }}>
              <span>📍</span>
              <span style={{ fontWeight: 700 }}>{popup.storage_binder}</span>
              {popup.storage_page && <span>· p.{popup.storage_page}</span>}
              {popup.storage_slot && <span>· {popup.storage_slot}</span>}
            </div>
          )}

          {/* Ma collection — owner seulement. Une carte peut appartenir à plusieurs collections. */}
          {isOwner && userId && (onCollectionsChange || onCollectionTagChange) && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase', marginBottom: 6 }}>
                Mes collections
              </label>
              {onCollectionsChange ? (
                <CollectionMultiSelect
                  userId={userId}
                  cardKey={popup.f}
                  value={popup.collections || []}
                  allTags={allCollectionTags || []}
                  onChange={(next) => onCollectionsChange(popup, next)}
                />
              ) : (
                <CollectionTagSelect
                  userId={userId}
                  value={tagInput}
                  onChange={async (tag) => { setTagInput(tag); setTagSaving(true); await onCollectionTagChange!(popup, tag); setTagSaving(false) }}
                />
              )}
            </div>
          )}

          {/* Setlist — owner only (DB + CSV) */}
          {isOwner && userId && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase', marginBottom: 6 }}>
                🃏 Setlist
              </label>

              {setPlacement === 'loading' ? (
                <span style={{ fontSize: 11, color: metaColor }}>…</span>
              ) : setPlacement ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Link href={`/setlist/${setPlacement.set_id}`} style={{ fontSize: 11, fontWeight: 800, color: accent, textDecoration: 'none' }}>
                    {setPlacement.set_name}
                    {setPlacement.set_year && <span style={{ fontWeight: 400, color: metaColor, marginLeft: 4 }}>({setPlacement.set_year})</span>}
                  </Link>
                  <button onClick={openPicker}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, border: `1px solid ${borderColor}`, background: 'none', color: metaColor, cursor: 'pointer' }}>
                    Changer
                  </button>
                  <button onClick={removeSetEntry}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 800 }}>
                    ✕
                  </button>
                </div>
              ) : (
                <button onClick={openPicker}
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: `1.5px dashed ${borderColor}`, background: 'none', color: metaColor, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  + Placer dans un set
                </button>
              )}

              {setPickerOpen && (
                <div style={{ marginTop: 8, background: dark ? '#1e1e1e' : '#f4f4f4', borderRadius: 12, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>

                  {/* ── Étape 1 : recherche du set ── */}
                  {setPickerStep === 'search' && (
                    <>
                      {/* Barre de recherche */}
                      <div style={{ display: 'flex', gap: 6, padding: '10px 10px 8px', borderBottom: `1px solid ${borderColor}` }}>
                        <input type="text" placeholder="Année"
                          value={setPickerYear}
                          onChange={e => {
                            setSetPickerYear(e.target.value)
                            if (setPickerTimerRef.current) clearTimeout(setPickerTimerRef.current)
                            setPickerTimerRef.current = setTimeout(() => searchSets(setPickerSearch, e.target.value), 300)
                          }}
                          style={{ width: 54, padding: '5px 7px', borderRadius: 6, border: `1px solid ${borderColor}`, fontSize: 11, background: dark ? '#2a2a2a' : 'white', color: textColor }}
                        />
                        <input type="text" placeholder="Nom du set…"
                          value={setPickerSearch} autoFocus
                          onChange={e => {
                            setSetPickerSearch(e.target.value)
                            if (setPickerTimerRef.current) clearTimeout(setPickerTimerRef.current)
                            setPickerTimerRef.current = setTimeout(() => searchSets(e.target.value, setPickerYear), 300)
                          }}
                          style={{ flex: 1, padding: '5px 7px', borderRadius: 6, border: `1px solid ${borderColor}`, fontSize: 11, background: dark ? '#2a2a2a' : 'white', color: textColor }}
                        />
                        <button onClick={() => setSetPickerOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: metaColor, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>✕</button>
                      </div>

                      {/* Suggestions (avant toute saisie) */}
                      {setPickerSearch.length < 2 && setPickerYear.length < 4 && setPickerSuggestions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px 4px' }}>
                            Suggestions
                          </div>
                          {setPickerSuggestions.map(s => (
                            <button key={s.id} onClick={() => selectSet(s)}
                              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: dark ? '#eee' : '#111', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${borderColor}` }}>
                              {sportEmoji(s.sport) && <span style={{ fontSize: 14, flexShrink: 0 }}>{sportEmoji(s.sport)}</span>}
                              <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
                              {s.total_cards > 0 && <span style={{ color: metaColor, flexShrink: 0, fontSize: 10 }}>{s.total_cards.toLocaleString()}</span>}
                              {s.brand && <span style={{ color: accent, fontSize: 10, flexShrink: 0 }}>{s.brand}</span>}
                              <span style={{ color: metaColor, fontSize: 13, flexShrink: 0 }}>›</span>
                            </button>
                          ))}
                          <div style={{ fontSize: 10, color: metaColor, padding: '6px 10px', textAlign: 'center' }}>
                            ↑ tape pour chercher tous les sets
                          </div>
                        </div>
                      )}

                      {/* Résultats de recherche */}
                      {(setPickerSearch.length >= 2 || setPickerYear.length >= 4) && (
                        setPickerResults.length === 0 ? (
                          <div style={{ fontSize: 11, color: metaColor, textAlign: 'center', padding: '12px 0' }}>Aucun résultat</div>
                        ) : (
                          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                            {setPickerResults.map(s => (
                              <button key={s.id} onClick={() => selectSet(s)}
                                style={{ width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: dark ? '#eee' : '#111', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${borderColor}` }}>
                                {sportEmoji(s.sport) && <span style={{ fontSize: 14, flexShrink: 0 }}>{sportEmoji(s.sport)}</span>}
                                <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
                                {s.year && <span style={{ color: metaColor, flexShrink: 0, fontSize: 10 }}>{s.year}</span>}
                                {s.brand && <span style={{ color: accent, fontSize: 10, flexShrink: 0 }}>{s.brand}</span>}
                                <span style={{ color: metaColor, fontSize: 13, flexShrink: 0 }}>›</span>
                              </button>
                            ))}
                          </div>
                        )
                      )}

                      {setPickerSearch.length < 2 && setPickerYear.length < 4 && setPickerSuggestions.length === 0 && (
                        <div style={{ fontSize: 11, color: metaColor, textAlign: 'center', padding: '12px 0' }}>
                          Tape le nom ou l&apos;année du set…
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>
          )}

          {/* ── Modal plein écran Étape 2 : setlist complète ── */}
          {setPickerOpen && setPickerStep === 'entries' && setPickerSelectedSet && createPortal(
            (() => {
              const mob = typeof window !== 'undefined' && window.innerWidth < 600
              const bg  = dark ? '#111' : '#f5f5f5'
              const card= dark ? '#1e1e1e' : '#fff'
              const grn = '#22c55e'
              const mBg = dark ? '#0d1f12' : '#f0fdf4'
              const mBd = dark ? '#1a3a22' : '#bbf7d0'
              const mTx = dark ? '#4ade80' : '#15803d'

              const ER = ({ e, hi }: { e: SetEntryRow; hi: boolean }) => {
                const saving = setPickerSaving === e.id
                return (
                  <div
                    onClick={() => !saving && confirmEntry(e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px',
                      borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`,
                      background: hi ? (dark ? '#0d2018' : '#f0fdf4') : 'transparent',
                      borderLeft: `3px solid ${hi ? grn : 'transparent'}`,
                      cursor: saving ? 'default' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                      transition: 'background .12s',
                    }}
                    onMouseEnter={ev => { if (!saving) (ev.currentTarget as HTMLElement).style.background = hi ? (dark ? '#122818' : '#dcfce7') : (dark ? '#222' : '#fafafa') }}
                    onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = hi ? (dark ? '#0d2018' : '#f0fdf4') : 'transparent' }}
                  >
                    <span style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 700, color: dark ? '#555' : '#ccc', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {e.card_number || '—'}
                    </span>
                    {e.image_url
                      ? <img src={e.image_url} alt="" style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 5, flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,.2)' }} />
                      : <div style={{ width: 34, height: 48, borderRadius: 5, background: dark ? '#2a2a2a' : '#eee', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: hi ? 700 : 500, color: hi ? (dark ? '#86efac' : '#15803d') : (dark ? '#ddd' : '#111'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.player_name}
                        {e.is_rc && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, background: '#f97316', color: 'white', borderRadius: 3, padding: '1px 4px' }}>RC</span>}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2, color: e.variation ? accent : (dark ? '#444' : '#ccc'), fontWeight: e.variation ? 700 : 400 }}>
                        {e.variation || 'Base'}
                      </div>
                    </div>
                    {hi && <span style={{ fontSize: 18, flexShrink: 0 }}>✓</span>}
                  </div>
                )
              }

              const isSearching = setPickerEntrySearch.trim().length >= 2
              const matchIds = new Set(setPickerEntryMatches.map(e => e.id))

              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, display: 'flex', flexDirection: 'column', background: bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

                  {/* ── Nav ── */}
                  <div style={{ background: card, borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <button onClick={() => setSetPickerStep('search')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: 14, fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ← Changer
                    </button>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: dark ? '#eee' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {setPickerSelectedSet.name}
                    </span>
                    <button onClick={() => setSetPickerOpen(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#666' : '#aaa', fontSize: 22, lineHeight: 1, padding: 0 }}>
                      ×
                    </button>
                  </div>

                  {/* ── Info carte + set ── */}
                  <div style={{ background: card, margin: '12px 12px 0', borderRadius: 16, boxShadow: dark ? '0 4px 20px rgba(0,0,0,.4)' : '0 4px 20px rgba(0,0,0,.08)', flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 14, padding: '16px 16px 12px' }}>
                      {popup.f && (
                        <div style={{ width: mob ? 52 : 68, height: mob ? 73 : 96, flexShrink: 0, perspective: '500px' }}>
                          <div style={{ width: '100%', height: '100%', transform: 'rotateY(-12deg) rotateX(6deg)', boxShadow: dark ? '5px 8px 24px rgba(0,0,0,.7)' : '4px 6px 18px rgba(0,0,0,.25)' }}>
                            <img src={popup.f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                          </div>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? '#888' : '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 4 }}>
                          Placer dans ce set
                        </div>
                        <div style={{ fontSize: mob ? 16 : 19, fontWeight: 900, color: dark ? '#f0f0f0' : '#0a0a0a', lineHeight: 1.2, marginBottom: 6 }}>
                          {popup.n}
                          {popup.v && <span style={{ fontSize: 13, fontWeight: 600, color: accent, marginLeft: 8 }}>{popup.v}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                          {setPickerSelectedSet.year && (
                            <span style={{ fontSize: 12, color: dark ? '#888' : '#888', fontWeight: 600 }}>{setPickerSelectedSet.year}</span>
                          )}
                          {setPickerSelectedSet.brand && (
                            <span style={{ fontSize: 12, color: accent, fontWeight: 700, background: dark ? accent + '22' : accent + '15', borderRadius: 6, padding: '1px 7px' }}>{setPickerSelectedSet.brand}</span>
                          )}
                          {setPickerSelectedSet.total_cards > 0 && (
                            <span style={{ fontSize: 12, color: dark ? '#555' : '#bbb', fontWeight: 600 }}>{setPickerSelectedSet.total_cards.toLocaleString()} cartes</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barre de recherche */}
                    <div style={{ padding: '0 12px 12px', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: dark ? '#555' : '#bbb', pointerEvents: 'none' }}>🔍</span>
                      <input type="text" autoFocus
                        placeholder="Chercher joueur, numéro…"
                        value={setPickerEntrySearch}
                        onChange={ev => {
                          const v = ev.target.value
                          setSetPickerEntrySearch(v)
                          if (setPickerEntryTimerRef.current) clearTimeout(setPickerEntryTimerRef.current)
                          if (v.trim().length >= 2) {
                            setSetPickerEntryLoading(true)
                            setPickerEntryTimerRef.current = setTimeout(() => searchEntries(v, setPickerSelectedSet!.id), 350)
                          } else {
                            setSetPickerEntries([])
                            setSetPickerEntryLoading(false)
                          }
                        }}
                        style={{ width: '100%', boxSizing: 'border-box' as const, padding: '11px 14px 11px 40px', borderRadius: 10, border: `1.5px solid ${dark ? '#333' : '#e0e0e0'}`, fontSize: 14, background: dark ? '#2a2a2a' : '#f5f5f5', color: dark ? '#eee' : '#111', outline: 'none', WebkitAppearance: 'none' as const }}
                      />
                    </div>
                  </div>

                  {/* ── Error ── */}
                  {setPickerError && (
                    <div style={{ margin: '10px 12px 0', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, fontSize: 13, color: '#dc2626', fontWeight: 700 }}>
                      ⚠️ {setPickerError}
                    </div>
                  )}

                  {/* ── Liste ── */}
                  <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as const, paddingTop: 12 }}>
                    {setPickerLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px 0', color: dark ? '#555' : '#aaa' }}>Chargement…</div>
                    ) : setPickerEntryLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px 0', color: dark ? '#555' : '#aaa' }}>Recherche…</div>
                    ) : isSearching ? (
                      <div style={{ margin: '0 12px', background: card, borderRadius: 12, overflow: 'hidden', boxShadow: dark ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.05)', border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
                        {setPickerEntries.length === 0
                          ? <div style={{ textAlign: 'center', padding: '40px 20px', color: dark ? '#555' : '#aaa', fontSize: 14 }}>Aucun résultat pour &ldquo;{setPickerEntrySearch}&rdquo;</div>
                          : setPickerEntries.map(e => <ER key={e.id} e={e} hi={matchIds.has(e.id)} />)
                        }
                      </div>
                    ) : (() => {
                        const byVar = new Map<string, SetEntryRow[]>()
                        for (const e of setPickerEntries) {
                          const v = e.variation || 'Base'
                          if (!byVar.has(v)) byVar.set(v, [])
                          byVar.get(v)!.push(e)
                        }
                        const toggleVar = (v: string) => setSetPickerOpenVars(prev => {
                          const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n
                        })
                        const varList = setPickerVariations.length > 0 ? setPickerVariations : [...byVar.keys()]
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 20px' }}>
                            {/* Correspondances joueur */}
                            {setPickerEntryMatches.length > 0 && (
                              <div style={{ background: mBg, border: `1px solid ${mBd}`, borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${mBd}` }}>
                                  <span style={{ fontSize: 14 }}>✦</span>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: mTx, flex: 1 }}>Correspondances · {popup.n}</span>
                                  <span style={{ background: grn, color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{setPickerEntryMatches.length}</span>
                                </div>
                                {setPickerEntryMatches.map(e => <ER key={e.id} e={e} hi={true} />)}
                              </div>
                            )}

                            {/* Grand set : hint recherche */}
                            {setPickerIsLargeSet && setPickerEntries.length === 0 && !isSearching && (
                              <div style={{ textAlign: 'center', padding: '18px 16px', fontSize: 13, color: dark ? '#888' : '#999', background: dark ? '#1a1a1a' : '#fafafa', borderRadius: 12, border: `1px dashed ${dark ? '#333' : '#e0e0e0'}` }}>
                                Ce set a {setPickerSelectedSet?.total_cards?.toLocaleString()} cartes —<br />
                                utilise la recherche pour trouver ta variation
                              </div>
                            )}

                            {/* Sections par variation */}
                            {varList.map(varName => {
                              const varEntries = byVar.get(varName) || []
                              if (varEntries.length === 0) return null
                              const open = setPickerOpenVars.has(varName)
                              const isBase = varName === 'Base'
                              return (
                                <div key={varName} style={{ background: card, borderRadius: 12, overflow: 'hidden', boxShadow: dark ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.05)', border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
                                  <div onClick={() => toggleVar(varName)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', userSelect: 'none' as const }}>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: isBase ? (dark ? '#eee' : '#111') : accent, flex: 1 }}>{varName}</span>
                                    <span style={{ fontSize: 12, color: dark ? '#555' : '#aaa' }}>{varEntries.length} cartes</span>
                                    <span style={{ fontSize: 12, color: dark ? '#444' : '#ccc', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s', display: 'inline-block' }}>▼</span>
                                  </div>
                                  {open && varEntries.map(e => <ER key={e.id} e={e} hi={false} />)}
                                </div>
                              )
                            })}

                            {setPickerEntries.length === 0 && setPickerEntryMatches.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '60px 20px', color: dark ? '#555' : '#aaa' }}>Aucune carte chargée</div>
                            )}
                            {setPickerSelectedSet.total_cards > setPickerEntries.length + setPickerEntryMatches.length && (
                              <div style={{ textAlign: 'center', padding: '12px', color: dark ? '#555' : '#bbb', fontSize: 12 }}>
                                {setPickerEntries.length + setPickerEntryMatches.length} / {setPickerSelectedSet.total_cards.toLocaleString()} — recherche pour affiner
                              </div>
                            )}
                          </div>
                        )
                      })()}
                  </div>
                </div>
              )
            })(),
            document.body
          )}

          {/* Boutons actions */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isOwner && popup.id_manuelle && userId && (
                <Link href={`/galerie/${userId}/editer/${popup.id_manuelle}`} style={{
                  background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#eee' : '#333',
                  border: 'none', borderRadius: 10, padding: '12px 14px',
                  fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  ✏️ {lang === 'fr' ? 'Modifier' : 'Edit'}
                </Link>
              )}
              {!popup.booklet && (
                <button onClick={toggleFlip90} title={lang === 'fr' ? 'Pivoter la carte à 90°' : 'Rotate card 90°'} style={{
                  background: flip90 ? accent : (dark ? '#2a2a2a' : '#f0f0f0'), color: flip90 ? 'white' : (dark ? '#eee' : '#333'),
                  border: 'none', borderRadius: 10, padding: '12px 14px',
                  fontWeight: 800, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
                  transition: '0.2s',
                }}>
                  🔄 {lang === 'fr' ? 'Rotation 90°' : 'Rotate 90°'}
                </button>
              )}
              <button onClick={() => setShowVideo(true)} style={{
                flex: 1, background: '#0d0d1f', color: 'white', border: 'none',
                borderRadius: 10, padding: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 14,
              }}>
                🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export as video'}
              </button>
              {userId && (
                <ShareButton
                  url={popup.id_manuelle ? `/s/${popup.id_manuelle}` : `/galerie/${userSlug || userId}/${cardSlug(popup.n, popup.y, popup.br, popup.s)}?src=${encodeURIComponent(popup.f)}`}
                  title={popup.n}
                  subtitle={[popup.y, popup.br, popup.s].filter(Boolean).join(' · ')}
                  buttonStyle={{
                    background: dark ? '#2a2a2a' : '#f0f0f0',
                    color: dark ? '#eee' : '#333',
                    border: 'none', borderRadius: 10, padding: '12px 14px',
                    fontWeight: 800, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
                  }}
                />
              )}
            </div>
            {(popup.lien_vinted || popup.lien_ebay) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {popup.lien_vinted && (
                  <a href={popup.lien_vinted} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, background: '#00B07D', border: 'none',
                    borderRadius: 10, padding: '11px 14px',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src="/vinted.png" alt="Vinted" style={{ height: 22, display: 'block', width: 'auto', background: 'transparent' }} />
                  </a>
                )}
                {popup.lien_ebay && (
                  <a href={popup.lien_ebay} target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, background: dark ? '#1e1e1e' : 'white',
                    border: `2px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 10, padding: '11px 14px',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {/* Logo eBay multicolore officiel */}
                    <svg height="22" viewBox="0 0 82 30" fill="none">
                      <text y="24" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="28">
                        <tspan fill="#E53238">e</tspan>
                        <tspan dx="-2" fill="#0064D2">b</tspan>
                        <tspan dx="-2" fill="#F5AF02">a</tspan>
                        <tspan dx="-2" fill="#86B817">y</tspan>
                      </text>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Proposer un échange — visiteur connecté seulement */}
          {!isOwner && onProposeTrade && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={onProposeTrade}
                style={{
                  width: '100%', border: '2px solid #003DA6', borderRadius: 10, padding: '11px',
                  fontWeight: 800, cursor: 'pointer', fontSize: 14,
                  background: 'transparent', color: '#003DA6', transition: '0.2s',
                }}
              >
                🔄 Proposer un échange
              </button>
            </div>
          )}

          {/* J'ai cette carte + Wishlist + Like — visiteur connecté, sur une ligne */}
          {!isOwner && (onAddToMyGallery || currentUserId || (likeData && onLike)) && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {onAddToMyGallery && (
                <button
                  disabled={addState === 'loading' || addState === 'added' || addState === 'duplicate'}
                  onClick={async () => { setAddState('loading'); const result = await onAddToMyGallery(); setAddState(result) }}
                  style={{
                    flex: 1, border: 'none', borderRadius: 10, padding: '9px 6px',
                    fontWeight: 800, cursor: addState === 'idle' ? 'pointer' : 'default', fontSize: 12,
                    background: addState === 'added' ? '#2e7d32' : addState === 'duplicate' ? (dark ? '#2a2a2a' : '#f0f0f0') : '#003DA6',
                    color: addState === 'duplicate' ? (dark ? '#aaa' : '#666') : 'white',
                    transition: '0.2s', textAlign: 'center', lineHeight: 1.3,
                  }}
                >
                  {addState === 'loading' ? '...' : addState === 'added' ? '✓ Ajoutée' : addState === 'duplicate' ? 'Déjà là' : lang === 'fr' ? '+ J\'ai cette carte' : '+ I have it'}
                </button>
              )}
              {currentUserId && (
                <button
                  disabled={wishlistLoading}
                  onClick={async () => {
                    setWishlistLoading(true)
                    if (inWishlist) {
                      await supabase.from('wishlist').delete().eq('user_id', currentUserId).eq('nom', popup.n).eq('annee', popup.y || '').eq('marque', popup.br || '')
                      setInWishlist(false)
                    } else {
                      await supabase.from('wishlist').insert({ user_id: currentUserId, nom: popup.n, annee: popup.y || '', marque: popup.br || '', collection: popup.s || '', variation: popup.v || null, num: popup.num || null, rc: popup.rc || false, auto: popup.auto || false, patch: popup.patch || false })
                      setInWishlist(true)
                    }
                    setWishlistLoading(false)
                  }}
                  style={{
                    flex: 1, borderRadius: 10, padding: '9px 6px',
                    fontWeight: 800, cursor: 'pointer', fontSize: 12, transition: '0.2s',
                    border: `2px solid ${inWishlist ? '#f59e0b' : (dark ? '#444' : '#cbd5e1')}`,
                    background: inWishlist ? (dark ? '#292210' : '#fffbeb') : 'transparent',
                    color: inWishlist ? '#f59e0b' : (dark ? '#888' : '#64748b'),
                    lineHeight: 1.3,
                  }}
                >
                  {inWishlist ? '⭐ Wishlist' : '☆ Wishlist'}
                </button>
              )}
              {likeData && onLike && currentUserId && (
                <button
                  onClick={onLike}
                  style={{
                    flex: 1, borderRadius: 10, padding: '9px 6px',
                    fontWeight: 800, cursor: 'pointer', fontSize: 12, transition: '0.2s',
                    border: `2px solid ${likeData.liked ? '#e53935' : (dark ? '#444' : '#cbd5e1')}`,
                    background: likeData.liked ? (dark ? '#290a0a' : '#fff0f0') : 'transparent',
                    color: likeData.liked ? '#e53935' : (dark ? '#888' : '#64748b'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 14, transition: '0.15s', transform: likeData.liked ? 'scale(1.2)' : 'scale(1)', display: 'inline-block' }}>
                    {likeData.liked ? '❤️' : '🤍'}
                  </span>
                  J'aime
                  {likeData.count > 0 && <span style={{ fontSize: 11 }}>({likeData.count})</span>}
                </button>
              )}
            </div>
          )}

          {onValueSave && (
            <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 14, marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>Valeur est.</span>
              <div style={{ position: 'relative', flex: 1, maxWidth: 140 }}>
                <input
                  type="number" min="0" step="0.01"
                  value={valeurInput}
                  onChange={e => setValeurInput(e.target.value)}
                  onBlur={() => {
                    const v = valeurInput.trim()
                    onValueSave(v === '' ? null : parseFloat(v))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = valeurInput.trim()
                      onValueSave(v === '' ? null : parseFloat(v))
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '5px 28px 5px 8px', borderRadius: 7, border: `1px solid ${borderColor}`, fontSize: 13, fontWeight: 700, background: dark ? '#222' : '#fafafa', color: textColor, boxSizing: 'border-box' }}
                />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>€</span>
              </div>
              <span style={{ fontSize: 10, color: '#bbb' }}>Privé</span>
            </div>
          )}

          <CardValueModule
            cardName={popup.n}
            set={`${popup.br} ${popup.s}`.trim()}
            year={popup.y}
            num={popup.num}
            variant={popup.v}
            rc={popup.rc}
            auto={popup.auto}
            patch={popup.patch}
            grade={popup.g}
            accent={accent}
            img={popup.f}
          />

          {/* PSA Population Report */}
          {popup.g?.toUpperCase().startsWith('PSA') && (() => {
            const psaGrade = popup.g?.match(/\d+(?:\.\d+)?/)?.[0] || ''
            const q = encodeURIComponent([popup.n, popup.y, popup.br, popup.s].filter(Boolean).join(' '))
            // Recherche PSA du site (résultats spécifiques à la carte : pop, APR, sets)
            const psaPopUrl  = `https://www.psacard.com/search?q=${q}`
            // Vrai numéro de cert renseigné → lien direct ; sinon page de recherche par cert
            const realCert = popup.cert_number?.trim()
            const psaCertUrl = realCert ? `https://www.psacard.com/cert/${encodeURIComponent(realCert)}` : `https://www.psacard.com/certlookup`
            return (
              <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <a href={psaCertUrl} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 11, fontWeight: 700, color: '#c0392b', textDecoration: 'none',
                  border: '1.5px solid #c0392b33', borderRadius: 20, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, transition: '0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c0392b' }}
                >
                  Infos de Gradation ↗
                </a>
                {psaGrade && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#aaa' }}>Note {psaGrade}</span>
                )}
              </div>
            )
          })()}

          {popup.n && (
            <SameCardCollectors
              cardName={popup.n}
              year={popup.y}
              brand={popup.br}
              set={popup.s}
              variant={popup.v}
              num={popup.num}
              rc={popup.rc}
              auto={popup.auto}
              patch={popup.patch}
              excludeUserId={userId}
              accent={accent}
            />
          )}

          {showVideo && <CardVideoExport card={popup} accent={accent} onClose={() => setShowVideo(false)} />}
        </div>
      </div>
    </div>
  )
}
