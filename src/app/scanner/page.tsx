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

function toBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ b64: (r.result as string).split(',')[1], mime: file.type || 'image/jpeg' })
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) } catch { return '' }
}

export default function ScannerPage() {
  const { dark } = useTheme()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'loading-ebay' | 'done' | 'error'>('idle')
  const [card, setCard] = useState<CardInfo | null>(null)
  const [ebay, setEbay] = useState<EbayResult | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'sold' | 'active'>('sold')

  const bg   = dark ? '#111' : '#f2f4f8'
  const card_bg = dark ? '#1e1e1e' : '#fff'
  const text = dark ? '#f0f0f0' : '#0d0d0d'
  const sub  = dark ? '#888' : '#666'
  const bdr  = dark ? '#2a2a2a' : '#e5e7eb'

  const reset = () => {
    setImgSrc(null); setCard(null); setEbay(null)
    setPhase('idle'); setErr(''); setTab('sold')
  }

  const scanFile = useCallback(async (file: File) => {
    const src = URL.createObjectURL(file)
    setImgSrc(src)
    setCard(null); setEbay(null); setErr(''); setPhase('scanning')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Connectez-vous pour scanner.'); setPhase('error'); return }

    const { b64, mime } = await toBase64(file)

    // Scan Gemini
    let identified: CardInfo | null = null
    try {
      const r = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Erreur scan')
      identified = d
      setCard(d)
    } catch (e: any) {
      setErr(e.message); setPhase('error'); return
    }

    // eBay en parallèle dès que la carte est identifiée
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
    } catch { /* eBay failure is non-fatal */ }
    setPhase('done')
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { scanFile(f); e.target.value = '' }
  }

  const Chip = ({ label, bg: cbg }: { label: string; bg: string }) => (
    <span style={{ background: cbg, color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 5, padding: '3px 8px', letterSpacing: 0.3 }}>{label}</span>
  )

  const PriceRow = ({ item }: { item: SaleItem }) => (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', background: dark ? '#161616' : '#f9fafb', borderRadius: 10, border: `1px solid ${bdr}`, textDecoration: 'none' }}>
      {item.img && <img src={item.img} alt="" style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 5, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.soldDate && <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>{fmt(item.soldDate)}</div>}
      </div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#003DA6', flexShrink: 0 }}>${item.price.toFixed(2)}</div>
    </a>
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header sticky */}
      <div style={{ position: 'sticky', top: 60, zIndex: 10, background: bg, borderBottom: `1px solid ${bdr}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 900, fontSize: 17, color: text }}>🔍 Scanner</span>
        {phase !== 'idle' && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: sub, background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
            ✕ Nouvelle carte
          </button>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 40px' }}>

        {/* Zone capture */}
        {phase === 'idle' ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <p style={{ color: sub, fontSize: 14, marginBottom: 28 }}>Passe la carte devant la caméra pour identifier et voir ses prix eBay.</p>

            {/* Bouton caméra principal */}
            <button onClick={() => cameraRef.current?.click()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', padding: '32px 0', background: '#003DA6', border: 'none', borderRadius: 20, cursor: 'pointer', color: 'white', marginBottom: 12 }}>
              <span style={{ fontSize: 52 }}>📷</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>Prendre une photo</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Caméra arrière recommandée</span>
            </button>

            <button onClick={() => galleryRef.current?.click()}
              style={{ width: '100%', padding: '14px 0', background: 'none', border: `2px solid ${bdr}`, borderRadius: 14, cursor: 'pointer', color: sub, fontSize: 14, fontWeight: 600 }}>
              🖼️ Importer depuis la galerie
            </button>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleInput} />
            <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInput} />
          </div>
        ) : (
          <>
            {/* Aperçu carte + état */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              {imgSrc && (
                <img src={imgSrc} alt="carte scannée"
                  style={{ width: 80, height: 112, objectFit: 'cover', borderRadius: 8, border: `2px solid ${bdr}`, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                {phase === 'scanning' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>⏳</span>
                      <span style={{ fontWeight: 700, color: text, fontSize: 15 }}>Identification…</span>
                    </div>
                    <div style={{ height: 4, background: bdr, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#003DA6', borderRadius: 4, animation: 'pulse-bar 1.2s ease-in-out infinite', width: '60%' }} />
                    </div>
                  </div>
                )}
                {(phase === 'loading-ebay' || phase === 'done') && card && (
                  <>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                      {card.rc && <Chip label="RC" bg="#e67e22" />}
                      {card.auto && <Chip label="AUTO" bg="#2e7d32" />}
                      {card.patch && <Chip label="PATCH" bg="#1976d2" />}
                      {card.num && <Chip label={card.num} bg="#7b1fa2" />}
                      {card.grade && card.grade !== 'Raw' && <Chip label={card.grade} bg="#c0392b" />}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 17, color: text, lineHeight: 1.2 }}>{card.nom || '—'}</div>
                    {card.equipe && <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>{card.equipe}</div>}
                    <div style={{ color: sub, fontSize: 12, marginTop: 4 }}>
                      {[card.annee, card.marque, card.collection, card.variation].filter(Boolean).join(' · ')}
                    </div>
                  </>
                )}
                {phase === 'error' && <p style={{ color: '#e74c3c', fontWeight: 700, fontSize: 14 }}>{err}</p>}
              </div>
            </div>

            {/* Stats prix vendus */}
            {(phase === 'loading-ebay' || phase === 'done') && (
              <div style={{ background: card_bg, borderRadius: 14, border: `1px solid ${bdr}`, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Valeur marché {phase === 'loading-ebay' && <span style={{ fontWeight: 400 }}>· chargement…</span>}
                  {phase === 'done' && ebay && ebay.soldCount > 0 && <span style={{ fontWeight: 400 }}>· {ebay.soldCount} ventes</span>}
                </div>
                {phase === 'done' && ebay && ebay.median > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[['Médiane', ebay.median, '#003DA6'], ['Min', ebay.min, '#27ae60'], ['Max', ebay.max, '#e74c3c']].map(([l, v, c]) => (
                      <div key={l as string} style={{ background: dark ? '#151515' : '#f5f7ff', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                        <div style={{ color: sub, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{l}</div>
                        <div style={{ fontWeight: 900, fontSize: 20, color: c as string }}>${(v as number).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : phase === 'done' ? (
                  <p style={{ color: sub, fontSize: 13, margin: 0 }}>Aucune vente récente trouvée.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ background: bdr, borderRadius: 10, height: 58, animation: 'pulse-bar 1.2s ease-in-out infinite' }} />)}
                  </div>
                )}
              </div>
            )}

            {/* Tabs ventes en cours / vendues */}
            {phase === 'done' && ebay && (ebay.sold.length > 0 || ebay.active.length > 0) && (
              <div style={{ background: card_bg, borderRadius: 14, border: `1px solid ${bdr}`, overflow: 'hidden' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${bdr}` }}>
                  {([['sold', `Vendues (${ebay.sold.length})`], ['active', `En vente (${ebay.active.length})`]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                      style={{ flex: 1, padding: '11px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 800 : 500, color: tab === key ? '#003DA6' : sub, borderBottom: tab === key ? '2px solid #003DA6' : '2px solid transparent', marginBottom: -1 }}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Liste */}
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                  {(tab === 'sold' ? ebay.sold : ebay.active).length === 0
                    ? <p style={{ color: sub, fontSize: 13, textAlign: 'center', padding: '16px 0', margin: 0 }}>Aucun résultat</p>
                    : (tab === 'sold' ? ebay.sold : ebay.active).map((item, i) => <PriceRow key={i} item={item} />)
                  }
                </div>
              </div>
            )}

            {/* Bouton rescanner */}
            {(phase === 'done' || phase === 'error') && (
              <button onClick={reset}
                style={{ marginTop: 16, width: '100%', padding: '14px 0', background: '#003DA6', border: 'none', borderRadius: 14, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                📷 Scanner une autre carte
              </button>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
