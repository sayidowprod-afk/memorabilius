'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface CardInfo {
  nom: string
  equipe: string
  annee: string
  marque: string
  collection: string
  variation: string
  num: string
  card_number: string
  grade: string
  rc: boolean
  auto: boolean
  patch: boolean
}

interface SaleItem {
  title: string
  price: number
  url: string
  img: string
  soldDate?: string
}

interface EbayResult {
  items: SaleItem[]
  count: number
  median: number
  min: number
  max: number
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function ScannerPage() {
  const { dark } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [imgB64, setImgB64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [scanning, setScanning] = useState(false)
  const [card, setCard] = useState<CardInfo | null>(null)
  const [scanErr, setScanErr] = useState('')
  const [loadingSales, setLoadingSales] = useState(false)
  const [ebay, setEbay] = useState<EbayResult | null>(null)
  const [ebayErr, setEbayErr] = useState('')

  const handleFile = async (file: File) => {
    setCard(null)
    setEbay(null)
    setScanErr('')
    setEbayErr('')
    const src = URL.createObjectURL(file)
    setImgSrc(src)
    const b64 = await toBase64(file)
    setImgB64(b64)
    setMimeType(file.type || 'image/jpeg')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const scanCard = async () => {
    if (!imgB64) return
    setScanning(true)
    setScanErr('')
    setCard(null)
    setEbay(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setScanErr('Connectez-vous pour utiliser le scanner.'); setScanning(false); return }
      const r = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: imgB64, mimeType }),
      })
      const data = await r.json()
      if (!r.ok || data.error) { setScanErr(data.error || 'Erreur analyse'); setScanning(false); return }
      setCard(data)
      fetchSales(data)
    } catch (e: any) {
      setScanErr(e.message)
    }
    setScanning(false)
  }

  const fetchSales = async (c: CardInfo) => {
    setLoadingSales(true)
    setEbayErr('')
    try {
      const params = new URLSearchParams({
        name: c.nom || '',
        set: c.collection || '',
        year: c.annee || '',
        num: c.num || '',
        variant: c.variation || '',
        rc: String(c.rc),
        auto: String(c.auto),
        patch: String(c.patch),
        grade: c.grade || '',
      })
      const r = await fetch(`/api/ebay-sold?${params}`)
      const data = await r.json()
      if (data.error) { setEbayErr(data.error); setLoadingSales(false); return }
      setEbay(data)
    } catch (e: any) {
      setEbayErr(e.message)
    }
    setLoadingSales(false)
  }

  const bg = dark ? '#1a1a1a' : '#f8f9fb'
  const card_bg = dark ? '#232323' : '#fff'
  const text = dark ? '#f0f0f0' : '#111'
  const sub = dark ? '#999' : '#666'
  const border = dark ? '#333' : '#e8e8e8'

  const chip = (label: string, color: string) => (
    <span key={label} style={{ background: color, color: 'white', fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '3px 8px' }}>{label}</span>
  )

  const formatDate = (s: string) => {
    if (!s) return ''
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) } catch { return '' }
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, color: text, marginBottom: 6 }}>🔍 Scanner une carte</h1>
        <p style={{ color: sub, marginBottom: 28, fontSize: 14 }}>Importe une photo de carte — l'IA l'identifie et affiche les ventes récentes eBay.</p>

        {/* Zone de drop / upload */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dark ? '#444' : '#ccc'}`,
            borderRadius: 16,
            padding: imgSrc ? 0 : '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dark ? '#1e1e1e' : '#fafafa',
            transition: 'border-color 0.2s',
            overflow: 'hidden',
            marginBottom: 20,
            position: 'relative',
          }}
        >
          {imgSrc ? (
            <>
              <img src={imgSrc} alt="carte" style={{ maxHeight: 320, maxWidth: '100%', display: 'block', margin: '0 auto', borderRadius: 14 }} />
              <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '4px 10px' }}>
                Cliquer pour changer
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <p style={{ color: sub, fontSize: 15, margin: 0 }}>Glisse une photo ici ou clique pour choisir</p>
              <p style={{ color: dark ? '#555' : '#bbb', fontSize: 12, marginTop: 6 }}>JPG, PNG, WEBP</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {imgSrc && (
          <button
            onClick={scanCard}
            disabled={scanning}
            style={{ width: '100%', padding: '14px 0', background: scanning ? '#555' : '#003DA6', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: scanning ? 'not-allowed' : 'pointer', marginBottom: 24 }}
          >
            {scanning ? '⏳ Analyse en cours...' : '🔍 Analyser la carte'}
          </button>
        )}

        {scanErr && <p style={{ color: '#e74c3c', fontWeight: 700, marginBottom: 16 }}>{scanErr}</p>}

        {/* Résultat scan */}
        {card && (
          <div style={{ background: card_bg, borderRadius: 16, border: `1px solid ${border}`, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {card.rc && chip('RC', '#e67e22')}
              {card.auto && chip('AUTO', '#2e7d32')}
              {card.patch && chip('PATCH', '#1976d2')}
              {card.num && chip(card.num, '#7b1fa2')}
              {card.grade && card.grade !== 'Raw' && chip(card.grade, '#c0392b')}
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 22, margin: '0 0 4px', color: text }}>{card.nom || '—'}</h2>
            {card.equipe && <p style={{ color: sub, fontSize: 14, margin: '0 0 12px' }}>{card.equipe}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {[
                ['Année', card.annee],
                ['Marque', card.marque],
                ['Collection', card.collection],
                ['Variation', card.variation],
                ['N° carte', card.card_number],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}>
                  <span style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</span>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ventes eBay */}
        {card && (
          <div style={{ background: card_bg, borderRadius: 16, border: `1px solid ${border}`, padding: 24 }}>
            <h3 style={{ fontWeight: 900, fontSize: 17, color: text, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🏷️ Ventes récentes eBay
              {loadingSales && <span style={{ color: sub, fontSize: 13, fontWeight: 500 }}>Chargement...</span>}
            </h3>

            {ebayErr && <p style={{ color: '#e74c3c', fontSize: 13 }}>{ebayErr}</p>}

            {ebay && !loadingSales && (
              <>
                {ebay.count === 0 ? (
                  <p style={{ color: sub, fontSize: 14 }}>Aucune vente trouvée pour cette carte.</p>
                ) : (
                  <>
                    {/* Prix résumé */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                      {[
                        ['Médiane', ebay.median],
                        ['Min', ebay.min],
                        ['Max', ebay.max],
                      ].map(([label, val]) => (
                        <div key={label as string} style={{ background: dark ? '#1a1a1a' : '#f5f7ff', borderRadius: 10, padding: '10px 18px', textAlign: 'center', flex: 1, minWidth: 90 }}>
                          <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                          <div style={{ fontWeight: 900, fontSize: 20, color: '#003DA6' }}>${(val as number).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Liste ventes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {ebay.items.map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 12, alignItems: 'center', background: dark ? '#1e1e1e' : '#fafafa', borderRadius: 10, padding: 10, textDecoration: 'none', border: `1px solid ${border}` }}>
                          {item.img && <img src={item.img} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                            {item.soldDate && <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{formatDate(item.soldDate)}</div>}
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 16, color: '#003DA6', flexShrink: 0 }}>${item.price.toFixed(2)}</div>
                        </a>
                      ))}
                    </div>

                    <button
                      onClick={() => fetchSales(card)}
                      style={{ marginTop: 16, width: '100%', padding: '10px 0', background: 'none', border: `1px solid ${border}`, borderRadius: 10, color: sub, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                    >
                      🔄 Actualiser les ventes
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
