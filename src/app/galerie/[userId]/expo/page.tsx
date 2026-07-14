'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Card {
  f: string
  n: string
  y: string
  br: string
  s: string    // collection/set
  v: string    // variation
  num: string  // numérotation
  t: string    // équipe
  g: string    // grade
  rc: boolean
  auto: boolean
  patch: boolean
  printing_plate?: boolean
  booklet?: boolean
}

function parseCSV(text: string): Card[] {
  return text.split(/\r?\n/).slice(4).map(row => {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    if (!c[0] || !c[0].includes('http')) return null
    return {
      f: c[0].trim(), n: (c[2] || '').trim(), t: (c[3] || '').trim(),
      y: (c[4] || '').trim(), br: (c[5] || '').trim(),
      s: (c[6] || '').trim(), v: (c[7] || '').trim(), num: (c[8] || '').trim(),
      auto: c[9]?.toLowerCase().includes('oui') || false,
      rc: c[10]?.toLowerCase().includes('oui') || false,
      patch: c[11]?.toLowerCase().includes('oui') || false,
      g: (c[12] || 'Raw').trim(),
      printing_plate: false, booklet: false,
    }
  }).filter(Boolean) as Card[]
}

function Badges({ card, big = false }: { card: Card; big?: boolean }) {
  const s = big ? { fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 6 } : { fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }
  return (
    <div style={{ display: 'flex', gap: big ? 6 : 2, flexWrap: 'wrap' }}>
      {card.rc && <span style={{ ...s, background: '#003DA6', color: '#fff' }}>RC</span>}
      {card.auto && <span style={{ ...s, background: '#8B0000', color: '#fff' }}>AUTO</span>}
      {card.patch && <span style={{ ...s, background: '#4a2c00', color: '#fff' }}>PATCH</span>}
      {card.printing_plate && <span style={{ ...s, background: '#222', color: '#fff' }}>PRINTING PLATE</span>}
      {card.booklet && <span style={{ ...s, background: '#5a3e00', color: '#fff' }}>BOOKLET</span>}
      {card.g && card.g !== 'Raw' && <span style={{ ...s, background: '#1a5c1a', color: '#fff' }}>{card.g}</span>}
    </div>
  )
}

function CardTile({ card, onClick }: { card: Card; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', aspectRatio: '2.5/3.5',
        background: '#1a1a1a', borderRadius: 8, overflow: 'visible',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-10px) scale(1.06)' : 'translateY(0) scale(1)',
        transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1)',
        zIndex: hovered ? 10 : 1,
      }}
    >
      <div style={{ borderRadius: 8, overflow: 'hidden', width: '100%', height: '100%', position: 'relative' }}>
        <img
          src={card.f} alt={card.n} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {!hovered && (card.rc || card.auto || card.patch) && (
          <div style={{ position: 'absolute', bottom: 3, left: 3 }}>
            <Badges card={card} />
          </div>
        )}
      </div>

      {/* Tooltip au hover */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '10px 12px',
          minWidth: 160, maxWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          pointerEvents: 'none', zIndex: 20,
        }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{card.n}</div>
          {(card.y || card.br) && (
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
              {[card.y, card.br].filter(Boolean).join(' · ')}
            </div>
          )}
          {card.s && <div style={{ fontSize: 11, color: '#888' }}>{card.s}</div>}
          {card.v && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{card.v}</div>}
          {card.num && <div style={{ fontSize: 11, color: '#666' }}>#{card.num}</div>}
          {(card.rc || card.auto || card.patch || card.g !== 'Raw') && (
            <div style={{ marginTop: 6 }}><Badges card={card} /></div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExpoPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'grid' | 'slide'>('grid')
  const [slideIdx, setSlideIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [profileName, setProfileName] = useState('')
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const { data: profile } = await supabase.from('profiles').select('display_name, lien_csv').eq('id', userId).single()
    if (profile?.display_name) setProfileName(profile.display_name)

    let csvCards: Card[] = []
    if (profile?.lien_csv) {
      try {
        const res = await fetch(profile.lien_csv + '&t=' + Date.now())
        if (res.ok) csvCards = parseCSV(await res.text())
      } catch { /* ignore */ }
    }

    let manuelles: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: batch } = await supabase
        .from('cartes_manuelles')
        .select('image_recto, nom, annee, marque, collection, variation, num, equipe, grade, rc, auto, patch, printing_plate, booklet')
        .eq('user_id', userId)
        .range(from, from + 999)
      if (!batch?.length) break
      manuelles.push(...batch)
      if (batch.length < 1000) break
    }
    const manCards: Card[] = manuelles.map(m => ({
      f: m.image_recto || '', n: m.nom || '', t: m.equipe || '',
      y: m.annee || '', br: m.marque || '', s: m.collection || '',
      v: m.variation || '', num: m.num || '', g: m.grade || 'Raw',
      rc: m.rc || false, auto: m.auto || false, patch: m.patch || false,
      printing_plate: m.printing_plate || false, booklet: m.booklet || false,
    })).filter(c => c.f)

    setCards([...csvCards, ...manCards])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (autoPlay && mode === 'slide') {
      autoRef.current = setInterval(() => setSlideIdx(i => (i + 1) % cards.length), 4000)
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [autoPlay, mode, cards.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back()
      if (mode !== 'slide') return
      if (e.key === 'ArrowRight') setSlideIdx(i => (i + 1) % cards.length)
      if (e.key === 'ArrowLeft') setSlideIdx(i => (i - 1 + cards.length) % cards.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, cards.length, router])

  const current = cards[slideIdx]

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', color: '#fff', zIndex: 99999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Barre de contrôles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ✕ Quitter
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, opacity: 0.6 }}>
            {profileName} · {cards.length} cartes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['grid', 'slide'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#000' : '#aaa',
              }}>
                {m === 'grid' ? '⊞ Grille' : '▶ Diaporama'}
              </button>
            ))}
          </div>
          {mode === 'slide' && (
            <button onClick={() => setAutoPlay(v => !v)} style={{
              border: 'none', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: autoPlay ? '#003DA6' : 'rgba(255,255,255,0.1)', color: '#fff',
            }}>
              {autoPlay ? '⏸ Pause' : '▷ Auto'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 15 }}>
          Chargement…
        </div>
      ) : mode === 'grid' ? (
        /* ── Mode grille ── */
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: 10, alignContent: 'start',
        }}>
          {cards.map((c, i) => (
            <CardTile key={i} card={c} onClick={() => { setSlideIdx(i); setMode('slide') }} />
          ))}
        </div>
      ) : (
        /* ── Mode diaporama ── */
        <div style={{ flex: 1, display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center', padding: '24px 32px', minHeight: 0, overflow: 'hidden' }}>
          {/* Carte */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            {current && (
              <img
                key={slideIdx}
                src={current.f}
                alt={current.n}
                style={{
                  maxHeight: '100%', maxWidth: '45vw',
                  objectFit: 'contain', borderRadius: 14,
                  boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
                  animation: 'fadeIn 0.35s ease',
                }}
              />
            )}
          </div>

          {/* Infos complètes */}
          {current && (
            <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: '100%' }}>
              <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.25 }}>{current.n}</div>

              {(current.rc || current.auto || current.patch || current.printing_plate || current.booklet || (current.g && current.g !== 'Raw')) && (
                <Badges card={current} big />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {current.t && <InfoRow label="Équipe" value={current.t} />}
                {current.y && <InfoRow label="Année" value={current.y} />}
                {current.br && <InfoRow label="Marque" value={current.br} />}
                {current.s && <InfoRow label="Collection" value={current.s} />}
                {current.v && <InfoRow label="Variation" value={current.v} />}
                {current.num && <InfoRow label="Numérotation" value={`#${current.num}`} />}
                {current.g && current.g !== 'Raw' && <InfoRow label="Grade" value={current.g} />}
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <button
                  onClick={() => setSlideIdx(i => (i - 1 + cards.length) % cards.length)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 50, width: 40, height: 40, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >‹</button>
                <span style={{ color: '#555', fontSize: 12, flex: 1, textAlign: 'center' }}>
                  {slideIdx + 1} / {cards.length}
                </span>
                <button
                  onClick={() => setSlideIdx(i => (i + 1) % cards.length)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 50, width: 40, height: 40, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >›</button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#555', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: 14, color: '#ddd', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
