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
  const setPickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setPickerEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOwner || !userId) { setSetPlacement(null); return }
    setSetPlacement('loading')
    setSetPickerOpen(false)

    if (popup.id_manuelle) {
      supabase.from('cartes_manuelles')
        .select('set_entry_id')
        .eq('id', popup.id_manuelle)
        .maybeSingle()
        .then(async ({ data }) => {
          if (!data?.set_entry_id) { setSetPlacement(null); return }
          const eid = data.set_entry_id as number
          const { data: cse } = await supabase.from('card_set_entries').select('id, set_id').eq('id', eid).maybeSingle()
          if (!cse) { setSetPlacement(null); return }
          const { data: cs } = await supabase.from('card_sets').select('id, name, year, brand, sport').eq('id', cse.set_id).maybeSingle()
          if (!cs) { setSetPlacement(null); return }
          setSetPlacement({ entry_id: eid, set_id: cs.id, set_name: cs.name, set_year: cs.year, set_brand: cs.brand, set_sport: cs.sport })
        })
    } else {
      // Carte CSV : lookup via user_set_completion + player name
      ;(async () => {
        const { data: entries } = await supabase
          .from('card_set_entries').select('id, set_id, variation')
          .eq('player_name', popup.n).limit(200)
        if (!entries?.length) { setSetPlacement(null); return }
        const { data: completions } = await supabase
          .from('user_set_completion').select('entry_id')
          .eq('user_id', userId).in('entry_id', entries.map(e => e.id))
        if (!completions?.length) { setSetPlacement(null); return }
        const completedIds = new Set(completions.map(c => c.entry_id))
        const matched = entries.filter(e => completedIds.has(e.id))
        if (!matched.length) { setSetPlacement(null); return }
        const setIds = [...new Set(matched.map(e => e.set_id))]
        const { data: sets } = await supabase.from('card_sets').select('id, name, year, brand, sport').in('id', setIds)
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
      })()
    }
  }, [popup.id_manuelle, popup.f, isOwner, userId])

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
      setSetPickerSuggestions(data || [])
    }
  }

  const searchSets = async (q: string, year: string) => {
    if (q.trim().length < 2 && year.trim().length < 4) { setSetPickerResults([]); return }
    let qry = supabase.from('card_sets').select('id, name, year, brand, sport, total_cards').limit(12)
    if (year.trim().length >= 4) qry = qry.eq('year', parseInt(year))
    if (q.trim().length >= 2) qry = qry.ilike('name', `%${q.trim()}%`)
    const { data } = await qry.order('total_cards', { ascending: false })
    setSetPickerResults(data || [])
  }

  const selectSet = async (s: { id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }) => {
    setSetPickerSelectedSet(s)
    setSetPickerStep('entries')
    setSetPickerLoading(true)
    setSetPickerEntries([])
    setSetPickerEntryMatches([])
    setSetPickerEntrySearch('')
    setSetPickerError(null)

    // Charger correspondances joueur + premières 200 entrées en parallèle
    const [exactRes, allRes] = await Promise.all([
      supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', s.id).eq('player_name', popup.n).order('card_number').limit(50),
      supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', s.id).order('card_number').limit(200),
    ])

    let matches: SetEntryRow[] = exactRes.data || []
    if (!matches.length) {
      const { data: fuzzy } = await supabase.from('card_set_entries')
        .select('id, card_number, player_name, variation, is_rc, image_url')
        .eq('set_id', s.id).ilike('player_name', `%${popup.n}%`).order('card_number').limit(30)
      matches = fuzzy || []
    }

    const matchIds = new Set(matches.map(e => e.id))
    const allEntries = allRes.data || []
    const rest = allEntries.filter(e => !matchIds.has(e.id))

    // Variations disponibles dans les 200 premières entrées
    const varSet = new Set<string>()
    for (const e of allEntries) varSet.add(e.variation ?? 'Base')
    const vars = ['Base', ...Array.from(varSet).filter(v => v !== 'Base').sort()]

    // Auto-ouvrir la variation de la carte correspondante
    const matchVar = matches[0]?.variation ?? 'Base'
    setSetPickerOpenVars(new Set([matchVar]))
    setSetPickerVariations(vars)
    setSetPickerEntryMatches(matches)
    setSetPickerEntries(rest)
    setSetPickerLoading(false)
  }

  const searchEntries = async (q: string, setId: number) => {
    if (!q.trim() || q.trim().length < 2) { setSetPickerEntries([]); setSetPickerEntryLoading(false); return }
    setSetPickerEntryLoading(true)
    const { data } = await supabase.from('card_set_entries')
      .select('id, card_number, player_name, variation, is_rc, image_url')
      .eq('set_id', setId)
      .or(`player_name.ilike.%${q.trim()}%,card_number.ilike.%${q.trim()}%`)
      .order('card_number').limit(100)
    setSetPickerEntries(data || [])
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

    const { error: uscErr } = await supabase.from('user_set_completion').upsert(
      { user_id: userId, entry_id: entry.id, manually_checked: true },
      { onConflict: 'user_id,entry_id' }
    )
    if (uscErr) {
      setSetPickerError(`Erreur: ${uscErr.message}`)
      setSetPickerSaving(null)
      return
    }

    const s = setPickerSelectedSet!
    setSetPlacement({ entry_id: entry.id, set_id: s.id, set_name: s.name, set_year: s.year, set_brand: s.brand, set_sport: s.sport })
    setSetPickerOpen(false)
    setSetPickerSaving(null)
  }

  const removeSetEntry = async () => {
    if (!userId || setPlacement === 'loading' || !setPlacement) return
    if (popup.id_manuelle) {
      await supabase.from('cartes_manuelles').update({ set_entry_id: null }).eq('id', popup.id_manuelle)
    }
    await supabase.from('user_set_completion').delete().eq('user_id', userId).eq('entry_id', setPlacement.entry_id)
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
            <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, display: 'flex', flexDirection: 'column', background: dark ? '#111' : '#f5f5f5' }}>

              {/* Header */}
              <div style={{ background: dark ? '#1a1a1a' : 'white', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${borderColor}`, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <button onClick={() => setSetPickerStep('search')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, fontSize: 15, fontWeight: 800, padding: 0 }}>
                  ←
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: dark ? '#eee' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {setPickerSelectedSet.name}
                  </div>
                  <div style={{ fontSize: 12, color: metaColor, marginTop: 2 }}>
                    {[setPickerSelectedSet.year, setPickerSelectedSet.brand].filter(Boolean).join(' · ')}
                    {setPickerSelectedSet.total_cards > 0 && ` · ${setPickerSelectedSet.total_cards.toLocaleString()} cartes`}
                  </div>
                </div>
                <button onClick={() => setSetPickerOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: metaColor, fontSize: 22, lineHeight: 1, padding: 0 }}>✕</button>
              </div>

              {/* Bannière carte à placer */}
              <div style={{ padding: '8px 20px', background: accent + '18', borderBottom: `2px solid ${accent}44`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: dark ? '#eee' : '#111' }}>📌 {popup.n}</span>
                {popup.v && <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{popup.v}</span>}
                <span style={{ fontSize: 11, color: metaColor, marginLeft: 4 }}>— Clique sur la bonne ligne</span>
              </div>

              {/* Barre de recherche */}
              <div style={{ padding: '10px 20px', background: dark ? '#1a1a1a' : 'white', borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
                <input type="text" autoFocus
                  placeholder={`Rechercher dans ${setPickerSelectedSet.name}…`}
                  value={setPickerEntrySearch}
                  onChange={e => {
                    const v = e.target.value
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
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${borderColor}`, fontSize: 14, background: dark ? '#2a2a2a' : '#f9f9f9', color: dark ? '#eee' : '#111', outline: 'none' }}
                />
              </div>

              {/* En-tête colonnes */}
              <div style={{ display: 'grid', gridTemplateColumns: '52px 44px 1fr', padding: '8px 20px', background: dark ? '#252525' : '#fafafa', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#bbb', letterSpacing: '0.5px', flexShrink: 0, borderBottom: `1px solid ${borderColor}` }}>
                <span>#</span><span></span><span>Joueur · Variation</span>
              </div>

              {/* Liste des entrées */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {setPickerLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: metaColor }}>Chargement…</div>
                ) : setPickerEntryLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: metaColor }}>Recherche…</div>
                ) : (() => {
                  const isSearching = setPickerEntrySearch.trim().length >= 2
                  const matchIds = new Set(setPickerEntryMatches.map(e => e.id))

                  const EntryRow = ({ entry, highlight }: { entry: SetEntryRow; highlight: boolean }) => {
                    const isSaving = setPickerSaving === entry.id
                    return (
                      <div
                        onClick={() => !isSaving && confirmEntry(entry)}
                        style={{
                          display: 'grid', gridTemplateColumns: '52px 44px 1fr', alignItems: 'center',
                          padding: '7px 20px', borderBottom: `1px solid ${borderColor}`,
                          background: highlight ? (dark ? accent + '20' : accent + '0d') : (dark ? '#111' : 'white'),
                          borderLeft: `4px solid ${highlight ? accent : 'transparent'}`,
                          cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.5 : 1,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isSaving) (e.currentTarget as HTMLElement).style.background = dark ? '#222' : '#f8f8f8' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = highlight ? (dark ? accent + '20' : accent + '0d') : (dark ? '#111' : 'white') }}
                      >
                        <span style={{ fontSize: 12, color: '#bbb', fontWeight: 700 }}>{entry.card_number || '—'}</span>
                        <div style={{ width: 36, height: 50, flexShrink: 0 }}>
                          {entry.image_url
                            ? <img src={entry.image_url} alt="" style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 4, display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                            : <div style={{ width: 36, height: 50, background: dark ? '#2a2a2a' : '#f0f0f0', border: `1px dashed ${borderColor}`, borderRadius: 4 }} />
                          }
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: highlight ? 700 : 400, color: highlight ? (dark ? '#eee' : '#111') : (dark ? '#aaa' : '#444'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.player_name}
                            {entry.is_rc && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 3, padding: '1px 5px' }}>RC</span>}
                          </div>
                          <div style={{ fontSize: 11, color: entry.variation ? accent : metaColor, fontWeight: entry.variation ? 600 : 400, marginTop: 2 }}>
                            {entry.variation || 'Base'}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (isSearching) {
                    if (!setPickerEntries.length) return <div style={{ textAlign: 'center', padding: '40px 0', color: metaColor }}>Aucun résultat pour &ldquo;{setPickerEntrySearch}&rdquo;</div>
                    return <>{setPickerEntries.map(e => <EntryRow key={e.id} entry={e} highlight={matchIds.has(e.id)} />)}</>
                  }

                  return (
                    <>
                      {setPickerEntryMatches.length > 0 && (
                        <>
                          <div style={{ padding: '8px 20px', background: dark ? '#1a2a1a' : '#f0fff4', borderBottom: `1px solid ${dark ? '#2a3a2a' : '#c3e6cb'}`, fontSize: 11, fontWeight: 800, color: '#2ecc71' }}>
                            🎯 Correspondances pour &ldquo;{popup.n}&rdquo; — {setPickerEntryMatches.length} carte{setPickerEntryMatches.length > 1 ? 's' : ''}
                          </div>
                          {setPickerEntryMatches.map(e => <EntryRow key={e.id} entry={e} highlight={true} />)}
                        </>
                      )}
                      {setPickerEntries.length > 0 && (
                        <>
                          <div style={{ padding: '8px 20px', background: dark ? '#252525' : '#fafafa', borderBottom: `1px solid ${borderColor}`, fontSize: 11, fontWeight: 800, color: metaColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Toutes les cartes
                            {setPickerSelectedSet.total_cards > setPickerEntries.length + setPickerEntryMatches.length
                              ? ` · ${setPickerEntries.length + setPickerEntryMatches.length} sur ${setPickerSelectedSet.total_cards.toLocaleString()} — recherche pour voir plus`
                              : ` · ${setPickerEntries.length}`
                            }
                          </div>
                          {setPickerEntries.map(e => <EntryRow key={e.id} entry={e} highlight={false} />)}
                        </>
                      )}
                      {setPickerEntryMatches.length === 0 && setPickerEntries.length === 0 && !setPickerLoading && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: metaColor }}>Aucune carte chargée</div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>,
            document.body
          )}

          {/* Boutons actions */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
