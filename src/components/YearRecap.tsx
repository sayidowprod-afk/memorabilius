'use client'
// « Mon année en cartes » : une image verticale (1080×1920) à partager, calculée sur l'appareil à partir de la galerie.
// Version de test : visible seulement en développement local (voir GalerieClient) tant qu'elle n'est pas validée.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type RC = { f: string; n: string; y?: string; s?: string; t?: string; created_at?: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; thumb?: string }
const W = 1080, H = 1920
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

async function bmp(url: string): Promise<ImageBitmap | null> {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? await createImageBitmap(await r.blob()) : null } catch { return null }
}

export default function YearRecap({ cards, values, ownerName, onClose }: { cards: RC[]; values: Map<string, number>; ownerName: string; onClose: () => void }) {
  const years = useMemo(() => [...new Set(cards.map(c => (c.created_at || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse(), [cards])
  const [year, setYear] = useState(years[0] || String(new Date().getFullYear()))
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const stats = useMemo(() => {
    const ofYear = cards.filter(c => (c.created_at || '').startsWith(year))
    const perMonth = new Array(12).fill(0)
    for (const c of ofYear) { const m = parseInt((c.created_at || '').slice(5, 7), 10) - 1; if (m >= 0 && m < 12) perMonth[m]++ }
    const bestM = perMonth.indexOf(Math.max(...perMonth))
    const count = (k: 'rc' | 'auto' | 'patch') => ofYear.filter(c => c[k]).length
    const brands = new Map<string, number>()
    for (const c of ofYear) if (c.s) brands.set(c.s, (brands.get(c.s) || 0) + 1)
    const topBrand = [...brands.entries()].sort((a, b) => b[1] - a[1])[0]
    const top = [...ofYear].filter(c => values.has(c.f) && /^https?:/.test(c.f)).sort((a, b) => (values.get(b.f) ?? 0) - (values.get(a.f) ?? 0)).slice(0, 3)
    const fallback = top.length ? top : ofYear.filter(c => /^https?:/.test(c.f)).slice(-3)
    return { added: ofYear.length, total: cards.length, perMonth, bestM, rc: count('rc'), auto: count('auto'), patch: count('patch'), topBrand, top: fallback, hasValue: top.length > 0 }
  }, [cards, values, year])

  const make = async () => {
    setBusy(true); setUrl(null)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#1b2f78')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    const T = (s: string, px: number, py: number, size: number, color = '#fff', weight = 800, align: CanvasTextAlign = 'center', maxW = W - 120) => {
      x.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; x.fillStyle = color; x.textAlign = align
      let o = s; while (x.measureText(o).width > maxW && o.length > 4) o = o.slice(0, -2)
      x.fillText(o === s ? s : o.trimEnd() + '…', px, py)
    }
    T('MON ANNÉE EN CARTES', W / 2, 150, 44, '#b8c4ff', 700)
    T(year, W / 2, 330, 230, '#ffd84d', 900)
    T(ownerName, W / 2, 400, 46, '#fff', 600)
    // chiffres clés
    T(String(stats.added), W / 2, 640, 210, '#fff', 900)
    T(stats.added > 1 ? 'cartes ajoutées' : 'carte ajoutée', W / 2, 705, 52, '#b8c4ff', 600)
    T(`${stats.total} cartes en tout aujourd’hui`, W / 2, 775, 40, '#fff', 500)
    const pills: [string, number][] = [['RC', stats.rc], ['AUTO', stats.auto], ['PATCH', stats.patch]]
    pills.forEach(([l, n], i) => {
      const px = 150 + i * 390
      x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(px - 130, 850, 260, 150)
      T(String(n), px, 940, 80, '#ffd84d', 900); T(l, px, 985, 32, '#b8c4ff', 700)
    })
    // histogramme mensuel
    const mx = Math.max(1, ...stats.perMonth)
    stats.perMonth.forEach((n, i) => {
      const bw = 60, gap = 24, left = (W - (12 * bw + 11 * gap)) / 2
      const bh = Math.max(6, (n / mx) * 220)
      x.fillStyle = i === stats.bestM && n > 0 ? '#ffd84d' : '#2f6bff'
      x.fillRect(left + i * (bw + gap), 1230 - bh, bw, bh)
      T(MONTHS[i].slice(0, 1).toUpperCase(), left + i * (bw + gap) + bw / 2, 1270, 28, '#b8c4ff', 700, 'center', 60)
    })
    if (stats.added > 0) T(`Meilleur mois : ${MONTHS[stats.bestM]} (${stats.perMonth[stats.bestM]})`, W / 2, 1345, 40, '#fff', 600)
    if (stats.topBrand) T(`Marque n°1 : ${stats.topBrand[0]} (${stats.topBrand[1]})`, W / 2, 1405, 40, '#fff', 600)
    // top cartes
    T(stats.hasValue ? 'MES CARTES LES PLUS PRÉCIEUSES' : 'MES DERNIÈRES CARTES', W / 2, 1500, 36, '#ffd84d', 800)
    const imgs = await Promise.all(stats.top.map(t => bmp(t.f)))
    const bw = 280, bhMax = 360, gap = 40
    const n = imgs.length
    imgs.forEach((b, i) => {
      if (!b) return
      const k = Math.min(bw / b.width, bhMax / b.height)
      const w = b.width * k, h = b.height * k
      const left = (W - (n * bw + (n - 1) * gap)) / 2 + i * (bw + gap) + (bw - w) / 2
      x.drawImage(b, left, 1530 + (bhMax - h) / 2, w, h) // bords nets
    })
    T('MEMORABILIUS', W / 2, 1900, 36, '#b8c4ff', 800)
    if (!alive.current) return
    c.toBlob(bl => { if (bl && alive.current) { setUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(bl) }) } setBusy(false) }, 'image/png')
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Mon année en cartes" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 600000, background: 'rgba(5,8,25,.85)', display: 'grid', placeItems: 'center', padding: 16, overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 100%)', background: '#0e1530', color: '#fff', border: '3px solid #243063', padding: 18 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>📅 Mon année en cartes <span style={{ fontSize: 11, background: '#ffd84d', color: '#000', padding: '2px 6px', marginLeft: 6 }}>TEST LOCAL</span></h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#aab3d1', lineHeight: 1.5 }}>Une image à partager avec tes chiffres de l’année : cartes ajoutées, mois le plus actif, marque n°1, tes plus belles cartes.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={year} onChange={e => { setYear(e.target.value); setUrl(null) }} style={{ padding: 8, background: '#17214a', color: '#fff', border: '2px solid #243063', fontWeight: 700 }}>
            {(years.length ? years : [year]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#aab3d1' }}>{stats.added} cartes ajoutées en {year}</span>
        </div>
        {url && <img src={url} alt="Aperçu du bilan" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block', marginBottom: 12, background: '#000' }} />}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-main btn-primary" onClick={make} disabled={busy}>{busy ? 'Création…' : url ? 'Refaire' : 'Créer l’image'}</button>
          {url && <a className="da-confirm-btn" href={url} download={`mon-annee-${year}.png`} style={{ textDecoration: 'none', display: 'inline-block' }}>Enregistrer</a>}
          <button type="button" className="da-confirm-btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
