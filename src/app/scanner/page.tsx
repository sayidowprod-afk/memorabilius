'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface CardInfo {
  nom: string; equipe: string; annee: string; marque: string
  collection: string; variation: string; num: string; card_number: string
  grade: string; rc: boolean; auto: boolean; patch: boolean
}
interface ImageMatch { id: string; title: string; price: number; img: string; url: string }
interface SaleItem  { title: string; price: number; url: string; img: string; soldDate?: string }
interface EbayResult {
  active: SaleItem[]; sold: SaleItem[]
  median: number; min: number; max: number; soldCount: number
}

function toBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ b64: (r.result as string).split(',')[1], mime: file.type || 'image/jpeg' })
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// Recadre l'image sur la carte détectée (crop bounding box des 4 coins)
function cropWithCorners(b64: string, corners: Record<string, {x:number,y:number}>): Promise<string> {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      const xs = Object.values(corners).map(c => c.x * W)
      const ys = Object.values(corners).map(c => c.y * H)
      const PAD = 12
      const x0 = Math.max(0,  Math.min(...xs) - PAD)
      const y0 = Math.max(0,  Math.min(...ys) - PAD)
      const x1 = Math.min(W,  Math.max(...xs) + PAD)
      const y1 = Math.min(H,  Math.max(...ys) + PAD)
      const cw = x1 - x0, ch = y1 - y0
      const canvas = document.createElement('canvas')
      canvas.width = cw; canvas.height = ch
      canvas.getContext('2d')!.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch)
      canvas.toBlob(blob => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob!)
      }, 'image/jpeg', 0.93)
    }
    img.src = `data:image/jpeg;base64,${b64}`
  })
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) } catch { return '' }
}
function usd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Phase = 'idle' | 'searching' | 'results' | 'loading-sold' | 'done' | 'error'

export default function ScannerPage() {
  const { dark } = useTheme()
  const router = useRouter()
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const versoRef   = useRef<HTMLInputElement>(null)

  const [phase,         setPhase]         = useState<Phase>('idle')
  const [imgSrc,        setImgSrc]        = useState<string | null>(null)
  const [versoSrc,      setVersoSrc]      = useState<string | null>(null)
  const [rectoB64,      setRectoB64]      = useState<string | null>(null)
  const [rectoMime,     setRectoMime]     = useState('image/jpeg')
  // Image search (eBay visual)
  const [imgMatches,    setImgMatches]    = useState<ImageMatch[] | null>(null)
  const [imgSearchDone, setImgSearchDone] = useState(false)
  // Gemini fallback
  const [card,          setCard]          = useState<CardInfo | null>(null)
  const [geminiDone,    setGeminiDone]    = useState(false)
  // Sold comps
  const [ebay,          setEbay]          = useState<EbayResult | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<ImageMatch | null>(null)
  const [soldTab,       setSoldTab]       = useState<'sold' | 'active'>('sold')
  const [err,           setErr]           = useState('')
  const [ownedByPlayer, setOwnedByPlayer] = useState<Map<string, number>>(new Map())
  const [collectionLoaded, setCollectionLoaded] = useState(false)

  const bg     = dark ? '#0a0a0a' : '#f0f2f7'
  const cardBg = dark ? '#161616' : '#ffffff'
  const text   = dark ? '#f0f0f0' : '#0d0d0d'
  const muted  = dark ? '#666'    : '#888'
  const border = dark ? '#252525' : '#e8eaed'
  const blue   = '#0046D1'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion?next=/scanner'); return }
      const { data: cartes } = await supabase
        .from('cartes_manuelles')
        .select('nom, annee, marque, collection, variation')
        .eq('user_id', data.user.id)
      if (cartes) {
        const norm = (s: string | null) => (s || '').toLowerCase().trim().replace(/^base$/i, '')
        const map = new Map<string, number>()
        for (const c of cartes) {
          const key = [norm(c.nom), norm(c.annee), norm(c.marque), norm(c.collection), norm(c.variation)].join('|')
          if (norm(c.nom)) map.set(key, (map.get(key) || 0) + 1)
        }
        setOwnedByPlayer(map)
      }
      setCollectionLoaded(true)
    })
  }, [])

  const reset = () => {
    setPhase('idle'); setImgSrc(null); setVersoSrc(null)
    setRectoB64(null); setImgMatches(null); setImgSearchDone(false)
    setCard(null); setGeminiDone(false); setEbay(null)
    setSelectedMatch(null); setErr(''); setSoldTab('sold')
  }

  const loadSoldComps = useCallback(async (query: string, c?: CardInfo | null) => {
    setEbay(null)
    setPhase('loading-sold')
    try {
      const params = query
        ? new URLSearchParams({ q: query })
        : new URLSearchParams({
            name: c?.nom || '', set: c?.collection || '', year: c?.annee || '',
            num: c?.num || '', variant: c?.variation || '',
            rc: String(c?.rc || false), auto: String(c?.auto || false),
            patch: String(c?.patch || false), grade: c?.grade || '',
          })
      const r = await fetch(`/api/ebay-sold?${params}`)
      const d = await r.json()
      setEbay({
        active: d.active || d.items || [],
        sold: d.sold || [],
        median: d.median || 0,
        min: d.min || 0,
        max: d.max || 0,
        soldCount: d.soldCount || 0,
      })
    } catch { /* non-fatal */ }
    setPhase('done')
  }, [])

  const pickMatch = useCallback((match: ImageMatch, currentCard: CardInfo | null) => {
    setSelectedMatch(match)
    loadSoldComps(match.title, currentCard)
  }, [loadSoldComps])

  const doScan = useCallback(async (b64: string, mime: string, versoB64?: string) => {
    setImgMatches(null); setImgSearchDone(false)
    setCard(null); setGeminiDone(false); setEbay(null)
    setSelectedMatch(null); setErr(''); setPhase('searching')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Connectez-vous pour scanner.'); setPhase('error'); return }

    // Phase 1 : eBay image search + détection coins en parallèle
    // L'image eBay utilise la photo brute (meilleur matching visuel avec le fond inclus)
    const imageSearchPromise = fetch('/api/ebay-image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ imageBase64: b64 }),
    }).then(r => r.json()).then(d => {
      const matches: ImageMatch[] = d.items || []
      setImgMatches(matches)
      setImgSearchDone(true)
      setPhase('results')
      return matches
    }).catch(() => {
      setImgSearchDone(true)
      setPhase('results')
      return [] as ImageMatch[]
    })

    // Détection coins : uniquement utile si eBay ne trouve rien (fallback Gemini)
    // On lance en parallèle pour ne pas perdre de temps si on en a besoin
    const cornersPromise: Promise<Record<string, {x:number;y:number}> & {confidence?: number} | null> = Promise.race([
      fetch('/api/detect-corners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime }),
      }).then(r => r.json()).catch(() => null),
      new Promise<null>(r => setTimeout(() => r(null), 5000)),
    ])

    // On attend eBay d'abord — pas la peine d'attendre les coins si eBay a trouvé
    const matches = await imageSearchPromise

    // Crop : utile uniquement si eBay a trouvé rien (améliore l'input Gemini)
    let aiB64 = b64
    if (matches.length === 0) {
      const corners = await cornersPromise
      if (corners && (corners.confidence ?? 0) >= 0.65 && corners.topLeft) {
        try { aiB64 = await cropWithCorners(b64, corners) } catch { /* fallback */ }
      }
    }

    // Gemini tourne toujours pour identifier la carte (infos + check collection)
    const identified = await fetch('/api/scan-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        imageBase64: aiB64,
        imageBase64Verso: versoB64,
        mimeType: mime,
        ...(matches.length > 0 && { ebayHints: matches.slice(0, 5).map(m => m.title) }),
      }),
    }).then(r => r.json()).then(d => {
      if (d.error) { setGeminiDone(true); return null }
      setCard(d)
      setGeminiDone(true)
      return d as CardInfo
    }).catch(() => {
      setGeminiDone(true)
      return null
    })

    // Prix vendus auto-chargés uniquement si eBay n'a rien trouvé
    if (identified && matches.length === 0) loadSoldComps('', identified)
  }, [loadSoldComps])

  const handleRecto = async (file: File) => {
    setImgSrc(URL.createObjectURL(file))
    setVersoSrc(null)
    const { b64, mime } = await toBase64(file)
    setRectoB64(b64)
    setRectoMime(mime)
    doScan(b64, mime)
  }

  const handleVerso = async (file: File) => {
    if (!rectoB64) return
    setVersoSrc(URL.createObjectURL(file))
    const { b64 } = await toBase64(file)
    doScan(rectoB64, rectoMime, b64)
  }

  const Chip = ({ label, bg: cbg }: { label: string; bg: string }) => (
    <span style={{ background: cbg, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 5, padding: '2px 7px', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{label}</span>
  )

  const SaleRow = ({ item }: { item: SaleItem }) => (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', background: dark ? '#111' : '#f8f9fb', borderRadius: 10, border: `1px solid ${border}`, textDecoration: 'none' }}>
      {item.img && <img src={item.img} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 5, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.soldDate && <div style={{ fontSize: 10, color: muted, marginTop: 1 }}>{fmtDate(item.soldDate)}</div>}
      </div>
      <div style={{ fontWeight: 900, fontSize: 14, color: blue, flexShrink: 0 }}>{usd(item.price)}</div>
    </a>
  )

  const isSearching = phase === 'searching'
  const showResults = phase === 'results' || phase === 'loading-sold' || phase === 'done' || phase === 'error'

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 10, background: dark ? '#0f0f0f' : '#fff', borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', height: 48 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: text }}>📷 Scanner de prix</span>
        {phase !== 'idle' && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: muted, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
            ✕ Nouvelle carte
          </button>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px 12px 80px' }}>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div style={{ paddingTop: 20 }}>
            <p style={{ textAlign: 'center', color: muted, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              Photo → correspondances eBay → prix vendus.<br />
              <strong style={{ color: text }}>Conçu pour les card shows.</strong>
            </p>
            <button onClick={() => cameraRef.current?.click()} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', minHeight: 230, background: blue, border: 'none',
              borderRadius: 22, cursor: 'pointer', color: '#fff', marginBottom: 12,
            }}>
              <span style={{ fontSize: 64, lineHeight: 1 }}>📷</span>
              <span style={{ fontSize: 22, fontWeight: 900 }}>Prendre une photo</span>
              <span style={{ fontSize: 13, opacity: 0.75 }}>Caméra arrière — carte bien à plat</span>
            </button>
            <button onClick={() => galleryRef.current?.click()} style={{
              width: '100%', padding: '14px 0', background: 'none', border: `2px solid ${border}`,
              borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700,
            }}>
              🖼️ Importer depuis la galerie
            </button>
            <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleRecto(f); e.target.value = '' }} />
            <input ref={galleryRef} type="file" accept="image/*"                        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleRecto(f); e.target.value = '' }} />
          </div>
        )}

        {/* ── SEARCHING ── */}
        {isSearching && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            {imgSrc && (
              <img src={imgSrc} alt="" style={{ width: 120, height: 170, objectFit: 'cover', borderRadius: 12, border: `2px solid ${border}`, marginBottom: 24 }} />
            )}
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>Recherche en cours…</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>Correspondances visuelles eBay…</div>
            <div style={{ height: 4, background: border, borderRadius: 4, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
              <div style={{ height: '100%', background: blue, borderRadius: 4, animation: 'slideIn 1.6s ease-in-out infinite', width: '50%' }} />
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {showResults && (
          <>
            {/* Photo miniature + info Gemini */}
            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, position: 'relative', width: 80 }}>
                  {imgSrc && (
                    <img src={imgSrc} alt="recto" style={{ width: 80, height: 112, objectFit: 'cover', borderRadius: 9, border: `2px solid ${border}` }} />
                  )}
                  {versoSrc && (
                    <img src={versoSrc} alt="verso" style={{ width: 50, height: 70, objectFit: 'cover', borderRadius: 6, border: `2px solid ${blue}`, position: 'absolute', bottom: -8, right: -12, boxShadow: '0 3px 10px rgba(0,0,0,0.35)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!geminiDone && imgSearchDone && (
                    <div style={{ fontSize: 12, color: muted, animation: 'pulse 1.4s ease-in-out infinite' }}>Identification IA…</div>
                  )}
                  {geminiDone && !card && (
                    <div style={{ fontSize: 12, color: muted }}>Identification impossible</div>
                  )}
                  {card && (
                    <>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {card.rc    && <Chip label="RC"    bg="#d97706" />}
                        {card.auto  && <Chip label="AUTO"  bg="#16a34a" />}
                        {card.patch && <Chip label="PATCH" bg="#1d4ed8" />}
                        {card.num   && <Chip label={card.num} bg="#7c3aed" />}
                        {card.grade && card.grade !== 'Raw' && <Chip label={card.grade} bg="#b91c1c" />}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: text, lineHeight: 1.2, marginBottom: 2 }}>{card.nom || '—'}</div>
                      {card.equipe && <div style={{ color: muted, fontSize: 12, marginBottom: 2 }}>{card.equipe}</div>}
                      <div style={{ color: muted, fontSize: 11, lineHeight: 1.5 }}>
                        {[card.annee, card.marque, card.collection].filter(Boolean).join(' · ')}
                        {card.variation && <><br /><em>{card.variation}</em></>}
                      </div>
                      {collectionLoaded && card.nom && (() => {
                        const norm = (s: string) => (s || '').toLowerCase().trim().replace(/^base$/i, '')
                        const key = [norm(card.nom), norm(card.annee), norm(card.marque), norm(card.collection), norm(card.variation)].join('|')
                        const count = ownedByPlayer.get(key) || 0
                        return count > 0
                          ? <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ {count} exemplaire{count > 1 ? 's' : ''} exact{count > 1 ? 's' : ''} dans ta collection</div>
                          : <div style={{ marginTop: 5, fontSize: 11, color: muted }}>Pas dans ta collection</div>
                      })()}
                    </>
                  )}
                </div>
              </div>

              {/* Bouton vers recherche texte Gemini si l'IA a identifié mais user n'a pas choisi */}
              {card && geminiDone && !selectedMatch && imgMatches && imgMatches.length > 0 && phase !== 'loading-sold' && phase !== 'done' && (
                <button type="button" onClick={() => loadSoldComps('', card)} aria-label="Utiliser l'identification IA pour les prix vendus" style={{
                  marginTop: 12, width: '100%', padding: '9px 0', background: 'none',
                  border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer',
                  color: muted, fontSize: 12, fontWeight: 700,
                }}>
                  Utiliser l'identification IA à la place <span aria-hidden="true">→</span>
                </button>
              )}
            </div>

            {/* ── GRILLE IMAGE SEARCH EBAY ── */}
            {!imgSearchDone && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                  🔍 Correspondances visuelles eBay
                  <span style={{ fontWeight: 400, marginLeft: 8, animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }}>chargement…</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}` }}>
                      <div style={{ height: 90, background: border, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      <div style={{ padding: '6px 7px' }}>
                        <div style={{ height: 8, background: border, borderRadius: 4, marginBottom: 5, animation: 'pulse 1.4s ease-in-out infinite' }} />
                        <div style={{ height: 8, background: border, borderRadius: 4, width: '60%', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imgSearchDone && imgMatches && imgMatches.length > 0 && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                  🔍 Correspondances visuelles eBay
                </div>
                <div style={{ fontSize: 11, color: muted, marginBottom: 12 }}>
                  Tape la carte qui correspond pour voir ses prix vendus
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {imgMatches.map(m => {
                    const selected = selectedMatch?.id === m.id
                    return (
                      <button key={m.id} onClick={() => pickMatch(m, card)}
                        style={{
                          background: selected ? (dark ? '#001a5c' : '#e8f0ff') : (dark ? '#111' : '#f8f9fb'),
                          border: `2px solid ${selected ? blue : border}`,
                          borderRadius: 10, cursor: 'pointer', padding: 0, overflow: 'hidden', textAlign: 'left',
                          transition: 'border-color 0.15s',
                        }}>
                        <img src={m.img} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block', background: dark ? '#0a0a0a' : '#f0f0f0' }} />
                        <div style={{ padding: '6px 7px' }}>
                          <div style={{ fontSize: 10, color: text, fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3, marginBottom: 3 }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: blue }}>{usd(m.price)}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {imgSearchDone && imgMatches && imgMatches.length === 0 && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: muted }}>
                  Aucune correspondance visuelle eBay — résultats basés sur l'identification IA.
                </div>
              </div>
            )}

            {/* ── PRIX VENDUS ── */}
            {(phase === 'loading-sold' || phase === 'done') && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {selectedMatch ? '✓ Carte sélectionnée' : 'Valeur marché'}
                  </span>
                  {phase === 'done' && ebay && ebay.soldCount > 0 && (
                    <span style={{ fontSize: 11, color: muted }}>{ebay.soldCount} ventes eBay US</span>
                  )}
                  {phase === 'loading-sold' && (
                    <span style={{ fontSize: 11, color: muted, animation: 'pulse 1.4s ease-in-out infinite' }}>chargement…</span>
                  )}
                </div>

                {selectedMatch && (
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${border}`, background: dark ? '#0a1228' : '#f0f4ff', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={selectedMatch.img} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedMatch.title}
                    </div>
                  </div>
                )}

                {phase === 'done' && ebay && ebay.median > 0 ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ textAlign: 'center', background: dark ? '#0d1a36' : '#eef3ff', borderRadius: 14, padding: '16px 12px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: dark ? '#6ea0ff' : '#3b6bde', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>
                        Médiane des ventes
                      </div>
                      <div style={{ fontSize: 52, fontWeight: 900, color: blue, lineHeight: 1, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>
                        {usd(ebay.median)}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: dark ? '#0a1f12' : '#f0fdf4', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Min</div>
                        <div style={{ fontWeight: 900, fontSize: 22, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{usd(ebay.min)}</div>
                      </div>
                      <div style={{ background: dark ? '#1f0a0a' : '#fff5f5', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Max</div>
                        <div style={{ fontWeight: 900, fontSize: 22, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{usd(ebay.max)}</div>
                      </div>
                    </div>
                  </div>
                ) : phase === 'done' ? (
                  <p style={{ color: muted, fontSize: 13, textAlign: 'center', padding: '20px 16px', margin: 0 }}>
                    Aucune vente récente trouvée.
                  </p>
                ) : (
                  <div style={{ padding: 16 }}>
                    <div style={{ height: 100, background: border, borderRadius: 14, marginBottom: 12, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[0, 1].map(i => <div key={i} style={{ height: 58, background: border, borderRadius: 12, animation: 'pulse 1.4s ease-in-out infinite' }} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs vendues / en vente */}
            {phase === 'done' && ebay && (ebay.sold.length > 0 || ebay.active.length > 0) && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
                  {(['sold', 'active'] as const).map(key => (
                    <button key={key} onClick={() => setSoldTab(key)} style={{
                      flex: 1, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: soldTab === key ? 800 : 500,
                      color: soldTab === key ? blue : muted,
                      borderBottom: soldTab === key ? `2px solid ${blue}` : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                      {key === 'sold' ? `Vendues (${ebay.sold.length})` : `En vente (${ebay.active.length})`}
                    </button>
                  ))}
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 360, overflowY: 'auto' }}>
                  {(soldTab === 'sold' ? ebay.sold : ebay.active).length === 0
                    ? <p style={{ color: muted, fontSize: 13, textAlign: 'center', padding: '14px 0', margin: 0 }}>Aucun résultat</p>
                    : (soldTab === 'sold' ? ebay.sold : ebay.active).map((item, i) => <SaleRow key={i} item={item} />)
                  }
                </div>
              </div>
            )}

            {/* Verso + nouvelle carte */}
            {(phase === 'results' || phase === 'done') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!versoSrc && (
                  <button onClick={() => versoRef.current?.click()} style={{
                    width: '100%', padding: '12px 0', background: 'none',
                    border: `2px dashed ${border}`, borderRadius: 14, cursor: 'pointer',
                    color: muted, fontSize: 13, fontWeight: 700,
                  }}>
                    📸 Ajouter le verso — améliore la détection
                  </button>
                )}
                <button onClick={reset} style={{
                  width: '100%', padding: '16px 0', background: blue, border: 'none',
                  borderRadius: 14, color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                }}>
                  📷 Scanner une autre carte
                </button>
                <input ref={versoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleVerso(f); e.target.value = '' }} />
              </div>
            )}

            {phase === 'error' && (
              <>
                <p style={{ color: '#dc2626', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>{err}</p>
                <button onClick={reset} style={{ width: '100%', padding: '14px 0', background: '#dc2626', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  🔄 Réessayer
                </button>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { 0% { transform: translateX(-150%); } 100% { transform: translateX(280%); } }
      `}</style>
    </div>
  )
}
