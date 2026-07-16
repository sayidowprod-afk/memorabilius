'use client'
import { useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface CardInfo {
  nom: string; equipe: string; annee: string; marque: string
  collection: string; variation: string; num: string; card_number: string
  grade: string; rc: boolean; auto: boolean; patch: boolean
}
interface SaleItem { title: string; price: number; url: string; img: string; soldDate?: string }
interface EbayResult {
  active: SaleItem[]; sold: SaleItem[]
  median: number; min: number; max: number; soldCount: number
}
type Phase = 'idle' | 'scanning' | 'loading-ebay' | 'done' | 'error'

function toBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ b64: (r.result as string).split(',')[1], mime: file.type || 'image/jpeg' })
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) } catch { return '' }
}

export default function ScannerPage() {
  const { dark } = useTheme()
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const versoRef   = useRef<HTMLInputElement>(null)

  const [imgSrc,    setImgSrc]    = useState<string | null>(null)
  const [versoSrc,  setVersoSrc]  = useState<string | null>(null)
  // Stored for verso rescan without re-uploading
  const [rectoB64,  setRectoB64]  = useState<string | null>(null)
  const [rectoMime, setRectoMime] = useState('image/jpeg')

  const [phase, setPhase] = useState<Phase>('idle')
  const [step,  setStep]  = useState(0) // 0 = photo, 1 = AI done, 2 = eBay done
  const [card,  setCard]  = useState<CardInfo | null>(null)
  const [ebay,  setEbay]  = useState<EbayResult | null>(null)
  const [err,   setErr]   = useState('')
  const [tab,   setTab]   = useState<'sold' | 'active'>('sold')

  const bg     = dark ? '#0a0a0a' : '#f0f2f7'
  const cardBg = dark ? '#161616' : '#ffffff'
  const text   = dark ? '#f0f0f0' : '#0d0d0d'
  const muted  = dark ? '#666'    : '#888'
  const border = dark ? '#252525' : '#e8eaed'
  const blue   = '#0046D1'

  const reset = () => {
    setImgSrc(null); setVersoSrc(null); setRectoB64(null)
    setCard(null); setEbay(null); setErr('')
    setPhase('idle'); setStep(0); setTab('sold')
  }

  const doScan = useCallback(async (b64: string, mime: string, versoB64?: string) => {
    setCard(null); setEbay(null); setErr(''); setPhase('scanning'); setStep(0)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Connectez-vous pour scanner.'); setPhase('error'); return }

    let identified: CardInfo | null = null
    try {
      const r = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: b64, imageBase64Verso: versoB64, mimeType: mime }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Erreur identification IA')
      identified = d
      setCard(d)
      setStep(1)
    } catch (e: any) {
      setErr(e.message); setPhase('error'); return
    }

    setPhase('loading-ebay')
    try {
      const c = identified!
      const params = new URLSearchParams({
        name: c.nom || '', set: c.collection || '', year: c.annee || '',
        num: c.num || '', variant: c.variation || '',
        rc: String(c.rc), auto: String(c.auto), patch: String(c.patch), grade: c.grade || '',
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
    setStep(2)
    setPhase('done')
  }, [])

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
      <div style={{ fontWeight: 900, fontSize: 14, color: blue, flexShrink: 0 }}>
        ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </a>
  )

  const StepDot = ({ i, label }: { i: number; label: string }) => {
    const done   = step > i
    const active = step === i && phase !== 'done' && phase !== 'error'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, flexShrink: 0,
          background: done ? '#16a34a' : active ? blue : border,
          color: done || active ? '#fff' : muted,
        }}>
          {done ? '✓' : i + 1}
        </span>
        <span style={{ fontSize: 11, fontWeight: done || active ? 700 : 400, color: done ? '#16a34a' : active ? text : muted, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 60, zIndex: 10, background: dark ? '#0f0f0f' : '#fff', borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', height: 48 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: text }}>📷 Scanner</span>
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
              Photo → IA identifie → prix eBay immédiats.<br />
              <strong style={{ color: text }}>Conçu pour les card shows.</strong>
            </p>

            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', minHeight: 230, background: blue, border: 'none',
                borderRadius: 22, cursor: 'pointer', color: '#fff', marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 64, lineHeight: 1 }}>📷</span>
              <span style={{ fontSize: 22, fontWeight: 900 }}>Prendre une photo</span>
              <span style={{ fontSize: 13, opacity: 0.75 }}>Caméra arrière — carte bien à plat</span>
            </button>

            <button
              onClick={() => galleryRef.current?.click()}
              style={{ width: '100%', padding: '14px 0', background: 'none', border: `2px solid ${border}`, borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700 }}
            >
              🖼️ Importer depuis la galerie
            </button>

            <input ref={cameraRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { handleRecto(f) }; e.target.value = '' }} />
            <input ref={galleryRef} type="file" accept="image/*"                        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { handleRecto(f) }; e.target.value = '' }} />
          </div>
        )}

        {/* ── NON-IDLE ── */}
        {phase !== 'idle' && (
          <>
            {/* Steps */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'center', background: cardBg, borderRadius: 14, border: `1px solid ${border}`, padding: '12px 14px', marginBottom: 14 }}>
              <StepDot i={0} label="Photo reçue" />
              <div style={{ flex: 1, height: 2, background: step > 0 ? '#16a34a' : border, margin: '0 8px' }} />
              <StepDot i={1} label="Identifiée" />
              <div style={{ flex: 1, height: 2, background: step > 1 ? '#16a34a' : border, margin: '0 8px' }} />
              <StepDot i={2} label="Prix eBay" />
            </div>

            {/* Card preview + identity */}
            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: '14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Images */}
                <div style={{ flexShrink: 0, position: 'relative', width: 88 }}>
                  {imgSrc && (
                    <img src={imgSrc} alt="recto"
                      style={{ width: 88, height: 124, objectFit: 'cover', borderRadius: 10, border: `2px solid ${border}`, display: 'block' }} />
                  )}
                  {versoSrc && (
                    <img src={versoSrc} alt="verso"
                      style={{ width: 54, height: 76, objectFit: 'cover', borderRadius: 7, border: `2px solid ${blue}`, position: 'absolute', bottom: -8, right: -14, boxShadow: '0 3px 10px rgba(0,0,0,0.35)' }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {phase === 'scanning' && (
                    <div>
                      <div style={{ fontSize: 13, color: muted, fontWeight: 700, marginBottom: 10 }}>
                        <span style={{ animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }}>⏳</span>{' '}
                        Identification en cours…
                      </div>
                      <div style={{ height: 8, background: border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: blue, borderRadius: 4, animation: 'slideIn 1.6s ease-in-out infinite', width: '55%' }} />
                      </div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>IA en cours d'analyse…</div>
                    </div>
                  )}

                  {card && (
                    <>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
                        {card.rc    && <Chip label="RC"    bg="#d97706" />}
                        {card.auto  && <Chip label="AUTO"  bg="#16a34a" />}
                        {card.patch && <Chip label="PATCH" bg="#1d4ed8" />}
                        {card.num   && <Chip label={card.num} bg="#7c3aed" />}
                        {card.grade && card.grade !== 'Raw' && <Chip label={card.grade} bg="#b91c1c" />}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 17, color: text, lineHeight: 1.2, marginBottom: 3 }}>{card.nom || '—'}</div>
                      {card.equipe && <div style={{ color: muted, fontSize: 12, marginBottom: 3 }}>{card.equipe}</div>}
                      <div style={{ color: muted, fontSize: 11, lineHeight: 1.5 }}>
                        {[card.annee, card.marque, card.collection].filter(Boolean).join(' · ')}
                        {card.variation && <><br /><em>{card.variation}</em></>}
                      </div>
                    </>
                  )}

                  {phase === 'error' && (
                    <p style={{ color: '#dc2626', fontWeight: 700, fontSize: 13, margin: 0 }}>{err}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Prix marché */}
            {(phase === 'loading-ebay' || phase === 'done') && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Valeur marché</span>
                  {phase === 'done' && ebay && ebay.soldCount > 0 && (
                    <span style={{ fontSize: 11, color: muted }}>{ebay.soldCount} ventes eBay US</span>
                  )}
                  {phase === 'loading-ebay' && (
                    <span style={{ fontSize: 11, color: muted, animation: 'pulse 1.4s ease-in-out infinite' }}>chargement…</span>
                  )}
                </div>

                {phase === 'done' && ebay && ebay.median > 0 ? (
                  <div style={{ padding: '16px' }}>
                    {/* Big median */}
                    <div style={{ textAlign: 'center', background: dark ? '#0d1a36' : '#eef3ff', borderRadius: 14, padding: '18px 12px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: dark ? '#6ea0ff' : '#3b6bde', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 }}>
                        Médiane des ventes
                      </div>
                      <div style={{ fontSize: 52, fontWeight: 900, color: blue, lineHeight: 1, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>
                        ${ebay.median.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    {/* Min / Max */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: dark ? '#0a1f12' : '#f0fdf4', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Min</div>
                        <div style={{ fontWeight: 900, fontSize: 22, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                          ${ebay.min.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ background: dark ? '#1f0a0a' : '#fff5f5', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Max</div>
                        <div style={{ fontWeight: 900, fontSize: 22, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                          ${ebay.max.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : phase === 'done' ? (
                  <p style={{ color: muted, fontSize: 13, textAlign: 'center', padding: '20px 16px', margin: 0 }}>
                    Aucune vente récente trouvée pour cette carte.
                  </p>
                ) : (
                  // Skeleton loading
                  <div style={{ padding: 16 }}>
                    <div style={{ height: 94, background: border, borderRadius: 14, marginBottom: 12, animation: 'pulse 1.4s ease-in-out infinite' }} />
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
                    <button key={key} onClick={() => setTab(key)} style={{
                      flex: 1, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: tab === key ? 800 : 500,
                      color: tab === key ? blue : muted,
                      borderBottom: tab === key ? `2px solid ${blue}` : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                      {key === 'sold' ? `Vendues (${ebay.sold.length})` : `En vente (${ebay.active.length})`}
                    </button>
                  ))}
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 380, overflowY: 'auto' }}>
                  {(tab === 'sold' ? ebay.sold : ebay.active).length === 0
                    ? <p style={{ color: muted, fontSize: 13, textAlign: 'center', padding: '16px 0', margin: 0 }}>Aucun résultat</p>
                    : (tab === 'sold' ? ebay.sold : ebay.active).map((item, i) => <SaleRow key={i} item={item} />)
                  }
                </div>
              </div>
            )}

            {/* Actions: verso + new scan */}
            {phase === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!versoSrc && (
                  <button onClick={() => versoRef.current?.click()} style={{
                    width: '100%', padding: '13px 0', background: 'none',
                    border: `2px dashed ${border}`, borderRadius: 14, cursor: 'pointer',
                    color: muted, fontSize: 13, fontWeight: 700,
                  }}>
                    📸 Ajouter le verso — améliore la précision
                  </button>
                )}
                <button onClick={reset} style={{
                  width: '100%', padding: '16px 0', background: blue, border: 'none',
                  borderRadius: 14, color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                }}>
                  📷 Scanner une autre carte
                </button>
                <input ref={versoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { handleVerso(f) }; e.target.value = '' }} />
              </div>
            )}

            {/* Error retry */}
            {phase === 'error' && (
              <button onClick={reset} style={{
                width: '100%', padding: '15px 0', background: '#dc2626', border: 'none',
                borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              }}>
                🔄 Réessayer
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { 0% { transform: translateX(-150%); } 100% { transform: translateX(280%); } }
      `}</style>
    </div>
  )
}
