'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'

interface LabelItem {
  url: string
  title: string
  subtitle: string
  image: string
  value: number | null
}

function QrCanvas({ url, size }: { url: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => {
      if (cancelled || !ref.current) return
      const fullUrl = `https://www.memorabilius.fr${url.startsWith('/') ? url : '/' + url}`
      QRCode.toCanvas(ref.current, fullUrl, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [url, size])
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, flexShrink: 0 }} />
}

// Etiquettes de vente imprimables (salon de cartes) : QR vers la fiche + nom +
// prix modifiable a la main (pas de champ "prix de vente" en base -- le prix
// est souvent decide/negocie sur place, donc laisse editable ici plutot que
// fige). Alimentee par la selection Multi-QR de la galerie (sessionStorage),
// pas une nouvelle selection separee.
export default function EtiquettesPage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const { dark } = useTheme()
  const { t } = useLang()
  const [items, setItems] = useState<LabelItem[] | null>(null)
  const [prices, setPrices] = useState<Record<number, string>>({})

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('mb_sale_labels')
      const parsed: LabelItem[] = raw ? JSON.parse(raw) : []
      setItems(parsed)
      const initPrices: Record<number, string> = {}
      parsed.forEach((it, i) => { if (it.value != null) initPrices[i] = it.value % 1 === 0 ? String(it.value) : it.value.toFixed(2) })
      setPrices(initPrices)
    } catch {
      setItems([])
    }
  }, [])

  const bg = dark ? '#121212' : '#f7f8fc'
  const text = dark ? '#f0f0f0' : '#111'

  if (items === null) return null

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .labels-toolbar { display: flex; align-items: center; gap: 12px; padding: 16px; max-width: 900px; margin: 0 auto; }
        .labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 900px; margin: 0 auto; padding: 0 16px 40px; }
        .label-card { border: 1px dashed #999; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; background: white; color: #111; box-sizing: border-box; }
        .label-price-input { width: 100%; text-align: center; font-weight: 900; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; padding: 3px; box-sizing: border-box; color: #111; }
        @media (max-width: 640px) { .labels-grid { grid-template-columns: repeat(2, 1fr); } }
        @media print {
          .labels-toolbar { display: none !important; }
          body { background: white !important; }
          .labels-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 6mm !important; padding: 0 !important; max-width: none !important; }
          .label-card { break-inside: avoid; border: 1px solid #333; }
          .label-price-input { border: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="labels-toolbar">
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          ← {t('labels_back')}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, flex: 1 }}>🏷️ {t('labels_title')} ({items.length})</h1>
        {items.length > 0 && (
          <button onClick={() => window.print()} style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            🖨️ {t('labels_print')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>{t('labels_empty')}</p>
      ) : (
        <div className="labels-grid">
          {items.map((it, i) => (
            <div key={i} className="label-card">
              <QrCanvas url={it.url} size={72} />
              <div style={{ fontWeight: 800, fontSize: 12, textAlign: 'center', lineHeight: 1.25 }}>{it.title}</div>
              {it.subtitle && <div style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>{it.subtitle}</div>}
              <input
                className="label-price-input"
                value={prices[i] ?? ''}
                onChange={e => setPrices(p => ({ ...p, [i]: e.target.value }))}
                placeholder={t('labels_price_placeholder')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
