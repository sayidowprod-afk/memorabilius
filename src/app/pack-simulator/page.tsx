'use client'
import { useEffect, useState, useCallback } from 'react'
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
}

type RarityTier = 'base' | 'rc' | 'uncommon' | 'rare' | 'ultra-rare'

interface DrawnCard {
  entry: Entry
  tier: RarityTier
  image: string | null
  owned: boolean
}

type PackTypeId = 'hobby' | 'blaster' | 'retail'

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

const RARITY_COLORS: Record<RarityTier, string> = {
  base: '#888',
  rc: '#e67e22',
  uncommon: '#2ecc71',
  rare: '#c0392b',
  'ultra-rare': '#f39c12',
}

const RARITY_LABELS: Record<RarityTier, string> = {
  base: 'Base',
  rc: 'Rookie',
  uncommon: 'Parallèle',
  rare: 'Rare',
  'ultra-rare': '★ ULTRA RARE',
}

function getRarityTier(variation: string | null, isRc: boolean): RarityTier {
  if (!variation || variation === 'Base') return isRc ? 'rc' : 'base'
  const v = variation.toLowerCase()
  if (v.includes('auto') || v.includes('1/1') || v.includes('black') || v.includes('superfractor')) return 'ultra-rare'
  if (v.includes('gold') || v.includes('red') || /\/\d{1,2}\b/.test(v)) return 'rare'
  if (
    v.includes('silver') || v.includes('holo') || v.includes('prizm') ||
    v.includes('refractor') || v.includes('parallel') || v.includes('press proof') ||
    v.includes('optic') || v.includes('mosaic')
  ) return 'uncommon'
  return isRc ? 'rc' : 'base'
}

const norm = (s: string) =>
  s?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '') || ''

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function PackSimulatorPage() {
  const { dark } = useTheme()
  const [step, setStep] = useState<'select-set' | 'select-type' | 'opening'>('select-set')
  const [sets, setSets] = useState<CardSet[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [searchSet, setSearchSet] = useState('')
  const [searchResults, setSearchResults] = useState<CardSet[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedSet, setSelectedSet] = useState<CardSet | null>(null)
  const [selectedPackType, setSelectedPackType] = useState<PackTypeId>('hobby')

  const [entriesByTier, setEntriesByTier] = useState<Record<RarityTier, Entry[]>>({
    base: [], rc: [], uncommon: [], rare: [], 'ultra-rare': [],
  })
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const [completedEntryIds, setCompletedEntryIds] = useState<Set<number>>(new Set())
  const [galleryCards, setGalleryCards] = useState<GalleryCard[]>([])
  const [loadingSet, setLoadingSet] = useState(false)

  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([])
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [revealing, setRevealing] = useState(false)
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
      const q = searchSet.trim()
      const { data } = await supabase
        .from('card_sets').select('*')
        .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
        .order('year', { ascending: false })
        .limit(60)
      setSearchResults(data || [])
      setSearchLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [searchSet])

  const loadSetData = useCallback(async (set: CardSet) => {
    setLoadingSet(true)
    const entries: Entry[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from('card_set_entries')
        .select('id, player_name, team, variation, is_rc, card_number')
        .eq('set_id', set.id)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      entries.push(...data)
      if (data.length < PAGE) break
    }
    setAllEntries(entries)

    const byTier: Record<RarityTier, Entry[]> = { base: [], rc: [], uncommon: [], rare: [], 'ultra-rare': [] }
    for (const e of entries) byTier[getRarityTier(e.variation, e.is_rc)].push(e)
    setEntriesByTier(byTier)

    if (userId) {
      const { data: gallery } = await supabase
        .from('cartes_manuelles')
        .select('nom, image_recto')
        .eq('user_id', userId)
      setGalleryCards(gallery || [])

      const ids = entries.map(e => e.id)
      const done = new Set<number>()
      const CHUNK = 500
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data: chunk } = await supabase
          .from('user_set_completion')
          .select('entry_id')
          .eq('user_id', userId)
          .in('entry_id', ids.slice(i, i + CHUNK))
        if (chunk) chunk.forEach(c => done.add(c.entry_id))
      }
      setCompletedEntryIds(done)
    }
    setLoadingSet(false)
  }, [userId])

  function findImage(entry: Entry): string | null {
    const key = norm(entry.player_name)
    for (const g of galleryCards) {
      if (!g.image_recto) continue
      const gn = norm(g.nom)
      if (gn === key || (key.length > 4 && gn.includes(key))) return g.image_recto
    }
    return null
  }

  function drawPack(packTypeId: PackTypeId): DrawnCard[] {
    const packType = PACK_TYPES.find(p => p.id === packTypeId)!
    const usedIds = new Set<number>()

    const resolveSlot = (tier: RarityTier): Entry | null => {
      const chain: RarityTier[] =
        tier === 'ultra-rare' ? ['ultra-rare', 'rare', 'uncommon', 'base'] :
        tier === 'rare' ? ['rare', 'uncommon', 'base'] :
        tier === 'uncommon' ? ['uncommon', 'base'] :
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
      const entry = resolveSlot(tier as RarityTier)
      if (!entry) return null
      return {
        entry,
        tier: getRarityTier(entry.variation, entry.is_rc),
        image: findImage(entry),
        owned: completedEntryIds.has(entry.id),
      }
    }).filter(Boolean) as DrawnCard[]
  }

  function handleSelectSet(set: CardSet) {
    setSelectedSet(set)
    loadSetData(set)
    setStep('select-type')
  }

  function handleOpenPack() {
    const pack = drawPack(selectedPackType)
    setDrawnCards(pack)
    setRevealed(new Set())
    setRevealing(false)
    setStep('opening')
  }

  async function revealAll() {
    if (revealing) return
    setRevealing(true)
    const unrevealed = drawnCards.map((_, i) => i).filter(i => !revealed.has(i))
    for (const i of unrevealed) {
      await new Promise(r => setTimeout(r, 180))
      setRevealed(prev => { const s = new Set(prev); s.add(i); return s })
    }
    setRevealing(false)
  }

  const bg = dark ? '#0a0a14' : '#f7f5f0'
  const cardBg = dark ? '#14142a' : '#fff'
  const text = dark ? '#fff' : '#111'
  const muted = dark ? '#666' : '#999'
  const border = dark ? 'rgba(255,255,255,0.1)' : '#eee'

  const filteredSets = searchResults ?? sets.filter(s =>
    !searchSet ||
    s.name.toLowerCase().includes(searchSet.toLowerCase()) ||
    (s.brand || '').toLowerCase().includes(searchSet.toLowerCase()) ||
    String(s.year || '').includes(searchSet)
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 80px' }}>
        <Link href="/" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 24, textDecoration: 'none' }}>
          ← Retour
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>🎴 Pack Simulator</h1>
        <p style={{ color: muted, fontSize: 14, marginBottom: 32, margin: '4px 0 32px' }}>
          Ouvre des packs virtuels avec les vraies chances des vrais packs.
        </p>

        {/* ── Step 1: Set selection ── */}
        {step === 'select-set' && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Choisir un set</h2>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                value={searchSet}
                onChange={e => setSearchSet(e.target.value)}
                placeholder="Rechercher (nom, marque, année)…"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  border: `1.5px solid ${border}`, background: cardBg, color: text,
                  fontSize: 14, boxSizing: 'border-box', outline: 'none',
                }}
              />
              {searchLoading && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #003DA6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              )}
            </div>
            {setsLoading ? (
              <div style={{ textAlign: 'center', color: muted, padding: 48 }}>Chargement…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
                {filteredSets.map(s => (
                  <button key={s.id} onClick={() => handleSelectSet(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      border: `1.5px solid ${border}`, background: cardBg, color: text,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                        {[s.year, s.brand, s.sport?.toUpperCase()].filter(Boolean).join(' · ')} · {s.total_cards} cartes
                      </div>
                    </div>
                    <span style={{ color: muted, flexShrink: 0 }}>→</span>
                  </button>
                ))}
                {filteredSets.length === 0 && (
                  <div style={{ textAlign: 'center', color: muted, padding: 48 }}>Aucun set trouvé.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Pack type selection ── */}
        {step === 'select-type' && selectedSet && (
          <div>
            <button onClick={() => setStep('select-set')}
              style={{ background: 'none', border: 'none', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
              ← Changer de set
            </button>
            <div style={{ background: cardBg, borderRadius: 12, padding: '14px 18px', marginBottom: 24, border: `1.5px solid ${border}` }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedSet.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                {[selectedSet.year, selectedSet.brand].filter(Boolean).join(' · ')} · {selectedSet.total_cards} cartes
              </div>
              {loadingSet && <div style={{ fontSize: 12, color: '#003DA6', marginTop: 8 }}>⏳ Chargement des entrées…</div>}
              {!loadingSet && allEntries.length > 0 && (
                <div style={{ fontSize: 12, color: '#2ecc71', marginTop: 8 }}>✓ {allEntries.length} cartes chargées</div>
              )}
            </div>

            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Type de pack</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {PACK_TYPES.map(pt => (
                <button key={pt.id} onClick={() => setSelectedPackType(pt.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                    borderRadius: 12,
                    border: `2px solid ${selectedPackType === pt.id ? '#003DA6' : border}`,
                    background: selectedPackType === pt.id ? (dark ? 'rgba(0,61,166,0.18)' : '#f0f4ff') : cardBg,
                    color: text, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
                  }}>
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{pt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{pt.label}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{pt.desc}</div>
                  </div>
                  {selectedPackType === pt.id && <span style={{ color: '#003DA6', fontWeight: 900 }}>✓</span>}
                </button>
              ))}
            </div>

            <button
              onClick={handleOpenPack}
              disabled={loadingSet || allEntries.length === 0}
              style={{
                width: '100%', padding: '16px', borderRadius: 12,
                background: loadingSet || allEntries.length === 0 ? '#ccc' : '#003DA6',
                color: 'white', border: 'none', fontWeight: 900, fontSize: 16,
                cursor: loadingSet || allEntries.length === 0 ? 'not-allowed' : 'pointer',
              }}>
              {loadingSet ? 'Chargement…' : '🎴 Ouvrir le pack'}
            </button>
          </div>
        )}

        {/* ── Step 3: Pack opening ── */}
        {step === 'opening' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedSet?.name}</div>
                <div style={{ fontSize: 12, color: muted }}>
                  {PACK_TYPES.find(p => p.id === selectedPackType)?.label}
                </div>
              </div>
              <button onClick={handleOpenPack}
                style={{ padding: '8px 14px', borderRadius: 10, background: '#003DA6', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                + Ouvrir un autre
              </button>
            </div>

            {revealed.size < drawnCards.length && (
              <button onClick={revealAll} disabled={revealing}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, marginBottom: 20,
                  background: 'none', border: `2px solid #003DA6`, color: '#003DA6',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}>
                {revealed.size === 0 ? '✨ Tout révéler' : `Révéler les ${drawnCards.length - revealed.size} restantes`}
              </button>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {drawnCards.map((card, idx) => {
                const isRevealed = revealed.has(idx)
                const tc = RARITY_COLORS[card.tier]
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      onClick={() => !isRevealed && setRevealed(prev => { const s = new Set(prev); s.add(idx); return s })}
                      style={{ width: '100%', perspective: 600, cursor: isRevealed ? 'default' : 'pointer' }}
                    >
                      <div style={{
                        position: 'relative', aspectRatio: '2.5/3.5', borderRadius: 8,
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.52s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        boxShadow: isRevealed && card.tier !== 'base'
                          ? `0 4px 20px ${tc}66`
                          : '0 2px 10px rgba(0,0,0,0.22)',
                      }}>
                        {/* Back */}
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 8,
                          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                          background: 'linear-gradient(145deg, #1a2a6c 0%, #003DA6 55%, #b21f1f 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{ fontSize: 36, opacity: 0.35 }}>🎴</div>
                        </div>
                        {/* Front */}
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden',
                          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          background: card.image
                            ? '#000'
                            : `linear-gradient(145deg, ${tc}28 0%, ${dark ? '#1a1a2e' : '#f5f5f5'} 100%)`,
                          border: `2px solid ${tc}`,
                        }}>
                          {card.image ? (
                            <img src={card.image} alt={card.entry.player_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 6px', boxSizing: 'border-box', textAlign: 'center' }}>
                              <div style={{ fontSize: 24, marginBottom: 6 }}>
                                {card.tier === 'ultra-rare' ? '⭐' : card.tier === 'rare' ? '💎' : card.tier === 'rc' ? '🔥' : '🏀'}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 900, color: text, lineHeight: 1.25, wordBreak: 'break-word' }}>
                                {card.entry.player_name}
                              </div>
                              {card.entry.team && (
                                <div style={{ fontSize: 9, color: muted, marginTop: 3 }}>{card.entry.team}</div>
                              )}
                            </div>
                          )}

                          {/* Rarity overlay at bottom */}
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: `linear-gradient(transparent, ${tc}ee)`,
                            padding: '14px 6px 5px',
                          }}>
                            <div style={{ fontSize: 8, fontWeight: 900, color: '#fff', textAlign: 'center', letterSpacing: 0.5, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                              {RARITY_LABELS[card.tier]}
                            </div>
                            {card.entry.variation && card.entry.variation !== 'Base' && (
                              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 1 }}>
                                {card.entry.variation}
                              </div>
                            )}
                          </div>

                          {/* Name overlay when image present */}
                          {card.image && (
                            <div style={{
                              position: 'absolute', top: 4, left: 4,
                              background: 'rgba(0,0,0,0.68)', borderRadius: 4,
                              padding: '2px 5px', fontSize: 9, fontWeight: 800, color: '#fff',
                              maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {card.entry.player_name}
                            </div>
                          )}

                          {/* Owned badge */}
                          {card.owned && (
                            <div style={{
                              position: 'absolute', top: 4, right: 4,
                              background: '#2ecc71', borderRadius: 4,
                              padding: '1px 4px', fontSize: 8, fontWeight: 900, color: '#fff',
                            }}>✓</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card meta below */}
                    {isRevealed && (
                      <div style={{ marginTop: 5, textAlign: 'center', width: '100%' }}>
                        {card.entry.card_number && (
                          <div style={{ fontSize: 9, color: muted }}>#{card.entry.card_number}</div>
                        )}
                        <div style={{ fontSize: 9, fontWeight: 700, color: card.owned ? '#2ecc71' : muted }}>
                          {card.owned ? '✓ Possédée' : 'Manquante'}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {revealed.size === drawnCards.length && drawnCards.length > 0 && (
              <div style={{ marginTop: 24, padding: '16px 18px', background: cardBg, borderRadius: 12, border: `1.5px solid ${border}` }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Résumé</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                  {(Object.keys(RARITY_COLORS) as RarityTier[]).map(tier => {
                    const count = drawnCards.filter(c => c.tier === tier).length
                    if (!count) return null
                    return (
                      <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: RARITY_COLORS[tier], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: text }}>{RARITY_LABELS[tier]}: {count}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: muted }}>
                  {drawnCards.filter(c => c.owned).length}/{drawnCards.length} déjà possédées dans ce set
                </div>
              </div>
            )}

            <button onClick={() => { setStep('select-type'); setDrawnCards([]); setRevealed(new Set()) }}
              style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 10, background: 'none', border: `1.5px solid ${border}`, color: muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ← Changer de set / type de pack
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 8px 2px currentColor; }
          50% { box-shadow: 0 0 18px 6px currentColor; }
        }
      `}</style>
    </div>
  )
}
