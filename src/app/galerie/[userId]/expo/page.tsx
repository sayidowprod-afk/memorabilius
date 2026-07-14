'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Card {
  f: string
  n: string
  y: string
  br: string
  rc: boolean
  auto: boolean
  patch: boolean
}

function parseCSV(text: string): Card[] {
  return text.split(/\r?\n/).slice(4).map(row => {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    if (!c[0] || !c[0].includes('http')) return null
    return {
      f: c[0].trim(), n: (c[2] || '').trim(), y: (c[4] || '').trim(),
      br: (c[5] || '').trim(),
      auto: c[9]?.toLowerCase().includes('oui') || false,
      rc: c[10]?.toLowerCase().includes('oui') || false,
      patch: c[11]?.toLowerCase().includes('oui') || false,
    }
  }).filter(Boolean) as Card[]
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
    const { data: profile } = await supabase.from('profiles').select('display_name, lien_csv, slug').eq('id', userId).single()
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
      const { data: batch } = await supabase.from('cartes_manuelles').select('image_recto, nom, annee, marque, rc, auto, patch').eq('user_id', userId).range(from, from + 999)
      if (!batch?.length) break
      manuelles.push(...batch)
      if (batch.length < 1000) break
    }
    const manCards: Card[] = manuelles.map(m => ({
      f: m.image_recto || '', n: m.nom || '', y: m.annee || '', br: m.marque || '',
      rc: m.rc || false, auto: m.auto || false, patch: m.patch || false,
    })).filter(c => c.f)

    setCards([...csvCards, ...manCards])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Auto-play slideshow
  useEffect(() => {
    if (autoPlay && mode === 'slide') {
      autoRef.current = setInterval(() => {
        setSlideIdx(i => (i + 1) % cards.length)
      }, 4000)
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [autoPlay, mode, cards.length])

  // Clavier : flèches + ESC
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ✕ Quitter
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, opacity: 0.7 }}>
            {profileName} · {cards.length} cartes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle mode */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['grid', 'slide'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#000' : '#aaa',
                }}
              >
                {m === 'grid' ? '⊞ Grille' : '▶ Diaporama'}
              </button>
            ))}
          </div>

          {mode === 'slide' && (
            <button
              onClick={() => setAutoPlay(v => !v)}
              style={{
                border: 'none', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: autoPlay ? '#003DA6' : 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            >
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
          flex: 1, overflowY: 'auto', padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8, alignContent: 'start',
        }}>
          {cards.map((c, i) => (
            <div
              key={i}
              onClick={() => { setSlideIdx(i); setMode('slide') }}
              style={{ position: 'relative', aspectRatio: '2.5/3.5', background: '#1a1a1a', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
            >
              <img
                src={c.f} alt={c.n} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
              {(c.rc || c.auto || c.patch) && (
                <div style={{ position: 'absolute', bottom: 3, left: 3, display: 'flex', gap: 2 }}>
                  {c.rc && <span style={{ background: '#003DA6', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>RC</span>}
                  {c.auto && <span style={{ background: '#8B0000', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>AU</span>}
                  {c.patch && <span style={{ background: '#4a2c00', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>PA</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── Mode diaporama ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 20, minHeight: 0 }}>
          {current && (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, width: '100%' }}>
                <img
                  key={slideIdx}
                  src={current.f}
                  alt={current.n}
                  style={{
                    maxHeight: '100%', maxWidth: '100%',
                    objectFit: 'contain', borderRadius: 12,
                    boxShadow: '0 20px 80px rgba(0,0,0,0.8)',
                    animation: 'fadeIn 0.3s ease',
                  }}
                />
              </div>

              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{current.n}</div>
                <div style={{ color: '#888', fontSize: 14, marginTop: 4 }}>{current.y}{current.br ? ` · ${current.br}` : ''}</div>
                {(current.rc || current.auto || current.patch) && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                    {current.rc && <span style={{ background: '#003DA6', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>RC</span>}
                    {current.auto && <span style={{ background: '#8B0000', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>AUTO</span>}
                    {current.patch && <span style={{ background: '#4a2c00', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>PATCH</span>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            <button
              onClick={() => setSlideIdx(i => (i - 1 + cards.length) % cards.length)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 50, width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ‹
            </button>
            <span style={{ color: '#555', fontSize: 13, minWidth: 80, textAlign: 'center' }}>
              {slideIdx + 1} / {cards.length}
            </span>
            <button
              onClick={() => setSlideIdx(i => (i + 1) % cards.length)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 50, width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
