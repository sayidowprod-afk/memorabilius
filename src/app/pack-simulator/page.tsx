'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface CardSet {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
}

interface Entry {
  id: number
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
  card_number: string | null
}

interface GalleryCard {
  nom: string
  image_recto: string | null
  marque: string | null
  collection: string | null
  annee: string | null
  variation: string | null
}

type RarityTier = 'base' | 'rc' | 'uncommon' | 'rare' | 'ultra-rare'
type PackTypeId = 'hobby' | 'blaster' | 'retail'
type Step = 'select-set' | 'select-type' | 'opening'
type PackPhase = 'pack-front' | 'opening-anim' | 'card-back' | 'card-front' | 'summary'

interface DrawnCard {
  entry: Entry
  tier: RarityTier
  image: string | null
  owned: boolean
}

interface PackType {
  id: PackTypeId
  label: string
  desc: string
  icon: string
  slots: RarityTier[]
  hitChance: number
}

const PACK_TYPES: PackType[] = [
  {
    id: 'hobby',
    label: 'Hobby',
    desc: '8 cartes · hit garanti (25% ultra-rare)',
    icon: '🏆',
    slots: ['base', 'base', 'base', 'base', 'base', 'rc', 'uncommon', 'rare'],
    hitChance: 0.25,
  },
  {
    id: 'blaster',
    label: 'Blaster',
    desc: '8 cartes · 1 parallèle',
    icon: '📦',
    slots: ['base', 'base', 'base', 'base', 'base', 'base', 'base', 'uncommon'],
    hitChance: 0,
  },
  {
    id: 'retail',
    label: 'Retail Hanger',
    desc: '10 cartes · 1 parallèle',
    icon: '🛒',
    slots: ['base', 'base', 'base', 'base', 'base', 'base', 'base', 'base', 'base', 'uncommon'],
    hitChance: 0,
  },
]

const RARITY_COLOR: Record<RarityTier, string> = {
  base: '#888',
  rc: '#e67e22',
  uncommon: '#2ecc71',
  rare: '#e91e9b',
  'ultra-rare': '#f39c12',
}

const RARITY_LABEL: Record<RarityTier, string> = {
  base: 'Base',
  rc: '🔥 Rookie',
  uncommon: '✦ Parallèle',
  rare: '💎 Rare',
  'ultra-rare': '⭐ ULTRA RARE',
}

function getRarity(variation: string | null, isRc: boolean): RarityTier {
  if (!variation || variation === 'Base') return isRc ? 'rc' : 'base'
  const v = variation.toLowerCase()
  if (v.includes('auto') || v.includes('1/1') || v.includes('black') || v.includes('superfractor')) return 'ultra-rare'
  if (v.includes('gold') || v.includes('red') || /\/\d{1,2}\b/.test(v)) return 'rare'
  if (v.includes('silver') || v.includes('holo') || v.includes('prizm') || v.includes('refractor') ||
      v.includes('parallel') || v.includes('press proof') || v.includes('mosaic') || v.includes('optic')) return 'uncommon'
  return isRc ? 'rc' : 'base'
}

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// Score-based gallery matching
function findImage(entry: Entry, set: CardSet, gallery: GalleryCard[]): string | null {
  const key = norm(entry.player_name)
  if (!key) return null
  let bestScore = 0
  let bestImg: string | null = null
  for (const g of gallery) {
    if (!g.image_recto) continue
    const gn = norm(g.nom)
    if (!gn.includes(key.slice(0, Math.max(4, key.length - 2))) && !key.includes(gn.slice(0, Math.max(4, gn.length - 2)))) continue
    let score = gn === key ? 10 : gn.includes(key) ? 5 : 3
    if (set.year && g.annee && g.annee.startsWith(String(set.year))) score += 3
    if (set.brand && g.marque && norm(g.marque).includes(norm(set.brand).slice(0, 4))) score += 3
    if (g.collection && norm(set.name).slice(0, 5) && norm(g.collection).includes(norm(set.name).slice(0, 5))) score += 2
    if (entry.variation && g.variation && norm(g.variation || '').slice(0, 4) === norm(entry.variation || '').slice(0, 4)) score += 2
    if (score > bestScore) { bestScore = score; bestImg = g.image_recto }
  }
  return bestScore >= 3 ? bestImg : null
}

// Fetch Pokemon TCG card images for a set
async function fetchPokemonImages(setName: string, entries: Entry[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  try {
    const q = encodeURIComponent(`set.name:"${setName}"`)
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&select=number,images&pageSize=250`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return map
    const json = await res.json()
    for (const card of json.data || []) {
      const img = card.images?.small || card.images?.large
      if (!img) continue
      // Match by card_number (exact or without leading zeros)
      const entry = entries.find(e => e.card_number === card.number || e.card_number === String(parseInt(card.number || '0', 10)))
      if (entry) map.set(entry.id, img)
    }
  } catch { /* API unavailable */ }
  return map
}

// Fetch MTG card images from Scryfall
async function fetchMtgImages(entries: Entry[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  try {
    const identifiers = entries.slice(0, 75).map(e => ({ name: e.player_name }))
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return map
    const json = await res.json()
    for (const card of json.data || []) {
      const img = card.image_uris?.normal || card.image_uris?.small || card.card_faces?.[0]?.image_uris?.normal
      if (!img) continue
      const entry = entries.find(e => norm(e.player_name) === norm(card.name))
      if (entry) map.set(entry.id, img)
    }
  } catch { /* API unavailable */ }
  return map
}

export default function PackSimulatorPage() {
  const { dark } = useTheme()
  const [step, setStep] = useState<Step>('select-set')
  const [sets, setSets] = useState<CardSet[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [searchSet, setSearchSet] = useState('')
  const [searchResults, setSearchResults] = useState<CardSet[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedSet, setSelectedSet] = useState<CardSet | null>(null)
  const [selectedPackType, setSelectedPackType] = useState<PackTypeId>('hobby')

  const [entriesByTier, setEntriesByTier] = useState<Record<RarityTier, Entry[]>>({ base: [], rc: [], uncommon: [], rare: [], 'ultra-rare': [] })
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const [completedEntryIds, setCompletedEntryIds] = useState<Set<number>>(new Set())
  const [galleryCards, setGalleryCards] = useState<GalleryCard[]>([])
  const [loadingSet, setLoadingSet] = useState(false)

  // Pack opening states
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([])
  const [packPhase, setPackPhase] = useState<PackPhase>('pack-front')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  useEffect(() => {
    supabase.from('card_sets').select('*').order('year', { ascending: false }).limit(300).then(({ data }) => {
      setSets(data || [])
      setSetsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (searchSet.length < 2) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase.from('card_sets').select('*')
        .or(`name.ilike.%${searchSet}%,brand.ilike.%${searchSet}%`)
        .order('year', { ascending: false }).limit(60)
      setSearchResults(data || [])
      setSearchLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [searchSet])

  const loadSetData = useCallback(async (set: CardSet) => {
    setLoadingSet(true)
    const entries: Entry[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('card_set_entries')
        .select('id, player_name, team, variation, is_rc, card_number')
        .eq('set_id', set.id).range(from, from + 999)
      if (!data?.length) break
      entries.push(...data)
      if (data.length < 1000) break
    }
    setAllEntries(entries)
    const byTier: Record<RarityTier, Entry[]> = { base: [], rc: [], uncommon: [], rare: [], 'ultra-rare': [] }
    for (const e of entries) byTier[getRarity(e.variation, e.is_rc)].push(e)
    setEntriesByTier(byTier)

    if (userId) {
      const { data: gallery } = await supabase.from('cartes_manuelles')
        .select('nom, image_recto, marque, collection, annee, variation')
        .eq('user_id', userId)
      setGalleryCards(gallery || [])
      const ids = entries.map(e => e.id)
      const done = new Set<number>()
      for (let i = 0; i < ids.length; i += 500) {
        const { data: chunk } = await supabase.from('user_set_completion').select('entry_id')
          .eq('user_id', userId).in('entry_id', ids.slice(i, i + 500))
        chunk?.forEach(c => done.add(c.entry_id))
      }
      setCompletedEntryIds(done)
    }
    setLoadingSet(false)
  }, [userId])

  function drawPack(packTypeId: PackTypeId): DrawnCard[] {
    const packType = PACK_TYPES.find(p => p.id === packTypeId)!
    const usedIds = new Set<number>()
    const resolve = (tier: RarityTier): Entry | null => {
      const chain: RarityTier[] = tier === 'ultra-rare' ? ['ultra-rare', 'rare', 'uncommon', 'base'] :
        tier === 'rare' ? ['rare', 'uncommon', 'base'] : tier === 'uncommon' ? ['uncommon', 'base'] :
        tier === 'rc' ? ['rc', 'base'] : ['base']
      for (const t of chain) {
        const avail = entriesByTier[t].filter(e => !usedIds.has(e.id))
        if (avail.length) { const e = pickRandom(avail); usedIds.add(e.id); return e }
      }
      const any = allEntries.filter(e => !usedIds.has(e.id))
      if (any.length) { const e = pickRandom(any); usedIds.add(e.id); return e }
      return null
    }
    const slots = [...packType.slots]
    if (packType.hitChance > 0 && Math.random() < packType.hitChance) {
      const idx = slots.lastIndexOf('rare')
      if (idx >= 0) slots[idx] = 'ultra-rare'
    }
    return slots.map(tier => {
      const entry = resolve(tier as RarityTier)
      if (!entry) return null
      return { entry, tier: getRarity(entry.variation, entry.is_rc), image: findImage(entry, selectedSet!, galleryCards), owned: completedEntryIds.has(entry.id) }
    }).filter(Boolean) as DrawnCard[]
  }

  async function handleOpenPack() {
    const pack = drawPack(selectedPackType)
    // Fetch external images if applicable
    if (selectedSet) {
      const sport = selectedSet.sport?.toLowerCase()
      let extMap = new Map<number, string>()
      const needsImg = pack.filter(c => !c.image)
      if (needsImg.length > 0) {
        if (sport === 'pokemon') {
          extMap = await fetchPokemonImages(selectedSet.name, needsImg.map(c => c.entry))
        } else if (sport === 'mtg') {
          extMap = await fetchMtgImages(needsImg.map(c => c.entry))
        }
      }
      if (extMap.size > 0) {
        pack.forEach(c => { if (!c.image && extMap.has(c.entry.id)) c.image = extMap.get(c.entry.id)! })
      }
    }
    setDrawnCards(pack)
    setCurrentIdx(0)
    setAnimKey(0)
    setPackPhase('pack-front')
    setStep('opening')
  }

  function openPackAnim() {
    setPackPhase('opening-anim')
    setTimeout(() => { setPackPhase('card-back') }, 700)
  }

  function flipCard() {
    if (packPhase === 'card-back') setPackPhase('card-front')
  }

  function nextCard() {
    if (currentIdx >= drawnCards.length - 1) {
      setPackPhase('summary')
    } else {
      setCurrentIdx(i => i + 1)
      setAnimKey(k => k + 1)
      setPackPhase('card-back')
    }
  }

  const bg = '#0a0a14'
  const cardBg = '#14142a'
  const muted = 'rgba(255,255,255,0.45)'
  const border = 'rgba(255,255,255,0.1)'

  const filteredSets = searchResults ?? sets.filter(s =>
    !searchSet || s.name.toLowerCase().includes(searchSet.toLowerCase()) ||
    (s.brand || '').toLowerCase().includes(searchSet.toLowerCase()) ||
    String(s.year || '').includes(searchSet)
  )

  const currentCard = drawnCards[currentIdx]
  const tc = currentCard ? RARITY_COLOR[currentCard.tier] : '#888'

  // ── Select set ──────────────────────────────────────────────────────
  if (step === 'select-set') return (
    <div style={{ minHeight: '100vh', background: bg, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 80px' }}>
        <Link href="/" style={{ color: '#6699ff', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 24, textDecoration: 'none' }}>← Retour</Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>🎴 Pack Simulator</h1>
        <p style={{ color: muted, fontSize: 14, margin: '4px 0 28px' }}>Ouvre des packs virtuels, carte par carte.</p>
        <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'rgba(255,255,255,0.8)' }}>Choisir un set</h2>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={searchSet} onChange={e => setSearchSet(e.target.value)} placeholder="Rechercher (nom, marque, année)…"
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${border}`, background: cardBg, color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          {searchLoading && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #6699ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
        </div>
        {setsLoading ? <div style={{ textAlign: 'center', color: muted, padding: 48 }}>Chargement…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '62vh', overflowY: 'auto' }}>
            {filteredSets.map(s => (
              <button key={s.id} onClick={() => { setSelectedSet(s); loadSetData(s); setStep('select-type') }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${border}`, background: cardBg, color: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{[s.year, s.brand, s.sport?.toUpperCase()].filter(Boolean).join(' · ')} · {s.total_cards} cartes</div>
                </div>
                <span style={{ color: muted, flexShrink: 0 }}>→</span>
              </button>
            ))}
            {filteredSets.length === 0 && <div style={{ textAlign: 'center', color: muted, padding: 48 }}>Aucun set trouvé.</div>}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Select pack type ─────────────────────────────────────────────────
  if (step === 'select-type') return (
    <div style={{ minHeight: '100vh', background: bg, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 80px' }}>
        <button onClick={() => setStep('select-set')} style={{ background: 'none', border: 'none', color: '#6699ff', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Changer de set</button>
        <div style={{ background: cardBg, borderRadius: 12, padding: '14px 18px', marginBottom: 28, border: `1.5px solid ${border}` }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedSet?.name}</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{[selectedSet?.year, selectedSet?.brand].filter(Boolean).join(' · ')} · {selectedSet?.total_cards} cartes</div>
          {loadingSet && <div style={{ fontSize: 12, color: '#6699ff', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, border: '2px solid #6699ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Chargement…</div>}
          {!loadingSet && allEntries.length > 0 && <div style={{ fontSize: 12, color: '#2ecc71', marginTop: 8 }}>✓ {allEntries.length} cartes chargées</div>}
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: 'rgba(255,255,255,0.8)' }}>Type de pack</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {PACK_TYPES.map(pt => (
            <button key={pt.id} onClick={() => setSelectedPackType(pt.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 12, border: `2px solid ${selectedPackType === pt.id ? '#6699ff' : border}`, background: selectedPackType === pt.id ? 'rgba(100,150,255,0.12)' : cardBg, color: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
              <span style={{ fontSize: 26 }}>{pt.icon}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{pt.label}</div><div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{pt.desc}</div></div>
              {selectedPackType === pt.id && <span style={{ color: '#6699ff', fontWeight: 900 }}>✓</span>}
            </button>
          ))}
        </div>
        <button onClick={handleOpenPack} disabled={loadingSet || allEntries.length === 0}
          style={{ width: '100%', padding: '18px', borderRadius: 14, background: loadingSet || allEntries.length === 0 ? '#333' : 'linear-gradient(135deg, #003DA6, #6633cc)', color: 'white', border: 'none', fontWeight: 900, fontSize: 17, cursor: loadingSet || allEntries.length === 0 ? 'not-allowed' : 'pointer', letterSpacing: 0.5 }}>
          {loadingSet ? 'Chargement…' : '🎴 Ouvrir le pack'}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Pack opening ──────────────────────────────────────────────────────
  const isUltra = currentCard?.tier === 'ultra-rare'
  const isRare = currentCard?.tier === 'rare'
  const isUncommon = currentCard?.tier === 'uncommon'
  const isRc = currentCard?.tier === 'rc'

  return (
    <div style={{ minHeight: '100vh', maxHeight: '100vh', overflow: 'hidden', background: bg, color: '#fff', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', flexShrink: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <button onClick={() => setStep('select-type')} style={{ background: 'none', border: 'none', color: muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>← {selectedSet?.name}</button>
        <div style={{ fontSize: 12, color: muted, fontWeight: 700 }}>
          {packPhase !== 'pack-front' && packPhase !== 'summary' && packPhase !== 'opening-anim'
            ? `${currentIdx + 1} / ${drawnCards.length}` : PACK_TYPES.find(p => p.id === selectedPackType)?.label}
        </div>
        <button onClick={handleOpenPack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '5px 10px', borderRadius: 6 }}>
          Nouveau
        </button>
      </div>

      {/* ── Pack front ── */}
      {(packPhase === 'pack-front' || packPhase === 'opening-anim') && (
        <div onClick={packPhase === 'pack-front' ? openPackAnim : undefined}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: packPhase === 'pack-front' ? 'pointer' : 'default', userSelect: 'none', padding: 20 }}>
          <div style={{
            width: 'min(200px, 50vw)', aspectRatio: '0.72',
            borderRadius: 14,
            background: 'linear-gradient(160deg, #1a2a6c 0%, #003DA6 45%, #6633cc 100%)',
            boxShadow: packPhase === 'opening-anim'
              ? '0 0 80px 30px rgba(100,150,255,0.8)'
              : '0 8px 40px rgba(0,61,166,0.6), 0 2px 12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(255,255,255,0.25)',
            animation: packPhase === 'pack-front' ? 'packFloat 3s ease-in-out infinite' : 'packOpen 0.7s ease forwards',
            padding: '20px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎴</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>{selectedSet?.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{[selectedSet?.year, selectedSet?.brand].filter(Boolean).join(' · ')}</div>
            <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {PACK_TYPES.find(p => p.id === selectedPackType)?.label}
            </div>
          </div>
          {packPhase === 'pack-front' && (
            <div style={{ marginTop: 28, color: 'rgba(255,255,255,0.5)', fontSize: 14, animation: 'blink 1.5s ease-in-out infinite' }}>
              Toucher pour ouvrir
            </div>
          )}
        </div>
      )}

      {/* ── Card back / front reveal ── */}
      {(packPhase === 'card-back' || packPhase === 'card-front') && currentCard && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', gap: 16, position: 'relative' }}>
          {/* Rarity background glow */}
          {packPhase === 'card-front' && currentCard.tier !== 'base' && (
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${tc}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
          )}

          {/* Card */}
          <div key={animKey} onClick={packPhase === 'card-back' ? flipCard : undefined}
            style={{
              width: 'min(280px, 72vw)',
              aspectRatio: '2.5/3.5',
              borderRadius: 12,
              cursor: packPhase === 'card-back' ? 'pointer' : 'default',
              perspective: 800,
              position: 'relative',
              zIndex: 2,
              animation: packPhase === 'card-back' ? 'cardEnter 0.5s cubic-bezier(0.34,1.56,0.64,1) both' : 'cardFlipIn 0.45s ease both',
            }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: 12, position: 'relative', overflow: 'hidden',
              boxShadow: packPhase === 'card-front' && currentCard.tier !== 'base'
                ? `0 0 30px 8px ${tc}55, 0 8px 32px rgba(0,0,0,0.7)`
                : '0 8px 32px rgba(0,0,0,0.7)',
              border: packPhase === 'card-front' ? `2px solid ${tc}88` : '2px solid rgba(255,255,255,0.2)',
              animation: packPhase === 'card-front' && (isUltra || isRare) ? 'rarityPulse 2s ease-in-out infinite' : 'none',
            }}>
              {packPhase === 'card-back' ? (
                /* Card back */
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #1a2a6c 0%, #003DA6 55%, #b21f1f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>🎴</div>
                </div>
              ) : currentCard.image ? (
                /* Real card image */
                <>
                  <img src={currentCard.image} alt={currentCard.entry.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {/* Shimmer overlay for parallels */}
                  {(isUncommon || isRare || isUltra) && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 12 }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', animation: 'shimmerSweep 2s ease-in-out infinite' }} />
                    </div>
                  )}
                </>
              ) : (
                /* Styled card template */
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(160deg, ${tc}33 0%, #0a0a14 60%, ${tc}22 100%)`, display: 'flex', flexDirection: 'column' }}>
                  {/* Top strip */}
                  <div style={{ background: `linear-gradient(90deg, ${tc}, ${tc}88)`, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>{currentCard.entry.team || selectedSet?.brand || ''}</span>
                    {currentCard.entry.card_number && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>#{currentCard.entry.card_number}</span>}
                  </div>
                  {/* Player name center */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: isUltra ? 44 : isRare ? 38 : 32, marginBottom: 12 }}>
                      {isUltra ? '⭐' : isRare ? '💎' : isRc ? '🔥' : isUncommon ? '✦' : '🏀'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.2, textShadow: `0 0 20px ${tc}` }}>
                      {currentCard.entry.player_name}
                    </div>
                    {currentCard.entry.team && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{currentCard.entry.team}</div>}
                    {currentCard.entry.variation && currentCard.entry.variation !== 'Base' && (
                      <div style={{ marginTop: 10, fontSize: 10, fontWeight: 800, color: tc, letterSpacing: 1, textTransform: 'uppercase', border: `1px solid ${tc}66`, padding: '3px 8px', borderRadius: 4 }}>
                        {currentCard.entry.variation}
                      </div>
                    )}
                  </div>
                  {/* Bottom strip */}
                  <div style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{selectedSet?.name}</span>
                    {currentCard.entry.is_rc && <span style={{ fontSize: 9, fontWeight: 900, color: '#e67e22', letterSpacing: 1 }}>RC</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card info */}
          {packPhase === 'card-front' && (
            <div style={{ textAlign: 'center', zIndex: 2, animation: 'fadeIn 0.4s ease both' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: tc, letterSpacing: 0.5 }}>{RARITY_LABEL[currentCard.tier]}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 4 }}>{currentCard.entry.player_name}</div>
              {currentCard.entry.variation && currentCard.entry.variation !== 'Base' && (
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{currentCard.entry.variation}</div>
              )}
              <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700, color: currentCard.owned ? '#2ecc71' : muted }}>
                {currentCard.owned ? '✓ Déjà dans ta collection' : 'Nouvelle carte'}
              </div>
            </div>
          )}

          {/* Tap instruction / next button */}
          {packPhase === 'card-back' && (
            <div style={{ fontSize: 13, color: muted, animation: 'blink 1.5s ease-in-out infinite', zIndex: 2 }}>Toucher pour révéler</div>
          )}
          {packPhase === 'card-front' && (
            <button onClick={nextCard}
              style={{ padding: '14px 32px', borderRadius: 12, background: `linear-gradient(135deg, ${tc}cc, ${tc}88)`, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', zIndex: 2, animation: 'fadeIn 0.5s 0.2s ease both', opacity: 0 }}>
              {currentIdx < drawnCards.length - 1 ? 'Carte suivante →' : 'Voir le résumé'}
            </button>
          )}

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, zIndex: 2 }}>
            {drawnCards.map((c, i) => (
              <div key={i} style={{ width: i === currentIdx ? 20 : 7, height: 7, borderRadius: 4, background: i < currentIdx ? RARITY_COLOR[c.tier] : i === currentIdx ? '#fff' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {packPhase === 'summary' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Pack terminé !</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
              {drawnCards.filter(c => !c.owned).length} nouvelles · {drawnCards.filter(c => c.owned).length} déjà possédées
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: 24 }}>
            {drawnCards.map((card, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: '100%', aspectRatio: '2.5/3.5', borderRadius: 8, overflow: 'hidden', border: `2px solid ${RARITY_COLOR[card.tier]}`, boxShadow: `0 0 8px ${RARITY_COLOR[card.tier]}44`, position: 'relative' }}>
                  {card.image ? (
                    <img src={card.image} alt={card.entry.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: `linear-gradient(145deg, ${RARITY_COLOR[card.tier]}33, #0a0a14)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{card.tier === 'ultra-rare' ? '⭐' : card.tier === 'rare' ? '💎' : card.tier === 'rc' ? '🔥' : card.tier === 'uncommon' ? '✦' : '🏀'}</div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{card.entry.player_name}</div>
                    </div>
                  )}
                  {card.owned && <div style={{ position: 'absolute', top: 3, right: 3, background: '#2ecc71', borderRadius: 3, padding: '1px 4px', fontSize: 8, fontWeight: 900, color: '#fff' }}>✓</div>}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: RARITY_COLOR[card.tier], textAlign: 'center' }}>
                  {RARITY_LABEL[card.tier].replace(/^[^\w]+/, '')}
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleOpenPack}
            style={{ width: '100%', padding: '16px', borderRadius: 12, background: 'linear-gradient(135deg, #003DA6, #6633cc)', color: '#fff', border: 'none', fontWeight: 900, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
            🎴 Ouvrir un autre pack
          </button>
          <button onClick={() => setStep('select-type')}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'none', border: '1.5px solid rgba(255,255,255,0.15)', color: muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Changer de set / type
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes packFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes packOpen {
          0% { transform: scale(1); opacity: 1; filter: brightness(1); }
          60% { transform: scale(1.15); opacity: 0.8; filter: brightness(3); }
          100% { transform: scale(0); opacity: 0; filter: brightness(5); }
        }
        @keyframes cardEnter {
          0% { transform: translateY(80px) scale(0.85); opacity: 0; }
          70% { transform: translateY(-8px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes cardFlipIn {
          0% { transform: rotateY(-90deg) scale(0.9); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes rarityPulse {
          0%, 100% { box-shadow: 0 0 20px 5px var(--tc, #f39c12); }
          50% { box-shadow: 0 0 45px 15px var(--tc, #f39c12); }
        }
        @keyframes shimmerSweep {
          0% { left: -50%; }
          100% { left: 150%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
