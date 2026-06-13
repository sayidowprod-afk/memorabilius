'use client'
import { useState } from 'react'

interface Card {
  f: string; n: string; v: string; y: string; br: string
  rc: boolean; auto: boolean; patch: boolean; num: string; g: string
}

interface Props {
  cards: Card[]
  profileName: string
  avatarUrl: string
  accent: string
  lang: string
}

const FORMATS = {
  a3:     { label: 'A3',    icon: '📄', w: 1754, h: 2480 },
  square: { label: 'Carré', icon: '⬛', w: 1080, h: 1080 },
  story:  { label: 'Story', icon: '📱', w: 1080, h: 1920 },
} as const
type FormatKey = keyof typeof FORMATS

const CARD_RATIO = 3.5 / 2.5
const HEADER_H = 96
const FOOTER_H = 36
const PAD = 20
const GAP = 8

const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="%23222"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-size="40">?</text></svg>'

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => { const fb = new Image(); fb.onload = () => resolve(fb); fb.src = PLACEHOLDER }
    img.src = src + (src.includes('?') ? '&' : '?') + '_e=1'
  })
}

// Trouve cols qui maximise la taille des cartes en remplissant width ET height
function bestCols(n: number, availW: number, availH: number): number {
  let bestCols = 1
  let bestArea = 0
  for (let c = 1; c <= Math.min(n, 12); c++) {
    const r = Math.ceil(n / c)
    // Taille max depuis la largeur
    const wFromW = (availW - GAP * (c - 1)) / c
    const hFromW = wFromW * CARD_RATIO
    // Taille max depuis la hauteur
    const hFromH = (availH - GAP * (r - 1)) / r
    const wFromH = hFromH / CARD_RATIO
    // On prend le min pour rentrer dans les deux dimensions
    const cardW = Math.min(wFromW, wFromH)
    const cardH = cardW * CARD_RATIO
    const area = cardW * cardH
    if (area > bestArea) { bestArea = area; bestCols = c }
  }
  return bestCols
}

async function generate(cards: Card[], profileName: string, avatarUrl: string, accent: string, lang: string, fmt: FormatKey): Promise<Blob> {
  const { w, h } = FORMATS[fmt]
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!

  const availW = w - PAD * 2
  const availH = h - HEADER_H - FOOTER_H - PAD * 2

  const cols = bestCols(cards.length, availW, availH)
  const rows = Math.ceil(cards.length / cols)

  // Taille des cartes calculée pour remplir les deux dimensions
  const cardWfromW = (availW - GAP * (cols - 1)) / cols
  const cardHfromH = (availH - GAP * (rows - 1)) / rows
  const cardW = Math.min(cardWfromW, cardHfromH / CARD_RATIO)
  const cardH = cardW * CARD_RATIO

  // Centrage de la grille dans la zone dispo
  const gridW = cols * cardW + GAP * (cols - 1)
  const gridH = rows * cardH + GAP * (rows - 1)
  const gridX = PAD + (availW - gridW) / 2
  const gridY = HEADER_H + PAD + (availH - gridH) / 2

  // === FOND ===
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, w, h)

  // === HEADER ===
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, w, HEADER_H)

  // Avatar
  const avS = Math.round(HEADER_H * 0.62)
  const avX = PAD + avS / 2
  const avY = HEADER_H / 2
  try {
    const av = await loadImg(avatarUrl)
    ctx.save()
    ctx.beginPath()
    ctx.arc(avX, avY, avS / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(av, PAD, avY - avS / 2, avS, avS)
    ctx.restore()
  } catch {}

  const textX = PAD + avS + 14
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(HEADER_H * 0.27)}px Arial, sans-serif`
  ctx.fillText(profileName, textX, avY - HEADER_H * 0.09)
  ctx.font = `${Math.round(HEADER_H * 0.165)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText(`${cards.length} carte${cards.length > 1 ? 's' : ''} · memorabilius.fr`, textX, avY + HEADER_H * 0.17)
  ctx.textAlign = 'right'
  ctx.font = `${Math.round(HEADER_H * 0.145)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), w - PAD, avY)
  ctx.textAlign = 'left'

  // === IMAGES ===
  const images = await Promise.all(cards.map(c => loadImg(c.f)))

  // === GRILLE ===
  const tagH = Math.max(14, Math.round(cardW * 0.085))
  const nameSize = Math.max(10, Math.round(cardW * 0.1))
  const varSize = Math.max(8, Math.round(cardW * 0.082))
  const overlayH = tagH + nameSize + varSize + 20

  cards.forEach((card, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = gridX + col * (cardW + GAP)
    const y = gridY + row * (cardH + GAP)

    // Ombre
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.drawImage(images[i], x, y, cardW, cardH)
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    // Gradient overlay bas de carte
    const grad = ctx.createLinearGradient(x, y + cardH - overlayH, x, y + cardH)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.82)')
    ctx.fillStyle = grad
    ctx.fillRect(x, y + cardH - overlayH, cardW, overlayH)

    // Tags
    const tags: { label: string; color: string }[] = []
    if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
    if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
    if (card.num) tags.push({ label: card.num, color: '#7b1fa2' })
    if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
    if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: accent })

    ctx.font = `bold ${Math.round(tagH * 0.72)}px Arial, sans-serif`
    ctx.textBaseline = 'middle'
    let tagX = x + 5
    const tagY = y + cardH - overlayH + 5
    tags.slice(0, 4).forEach(tag => {
      const tw = ctx.measureText(tag.label).width + tagH * 0.8
      ctx.fillStyle = tag.color
      ctx.beginPath()
      ctx.roundRect(tagX, tagY, tw, tagH, 3)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(tag.label, tagX + tagH * 0.4, tagY + tagH / 2)
      tagX += tw + 4
    })

    // Nom
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${nameSize}px Arial, sans-serif`
    const nameY = y + cardH - overlayH + tagH + 8
    let name = card.n
    while (name.length > 1 && ctx.measureText(name).width > cardW - 10) name = name.slice(0, -1)
    if (name !== card.n) name += '…'
    ctx.fillText(name, x + 5, nameY)

    // Variation
    if (card.v) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = `${varSize}px Arial, sans-serif`
      let v = card.v
      while (v.length > 1 && ctx.measureText(v).width > cardW - 10) v = v.slice(0, -1)
      if (v !== card.v) v += '…'
      ctx.fillText(v, x + 5, nameY + nameSize + 2)
    }
  })

  // === FOOTER ===
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, h - FOOTER_H, w, FOOTER_H)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = `${Math.round(FOOTER_H * 0.38)}px Arial, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText('memorabilius.fr', w / 2, h - FOOTER_H / 2)
  ctx.textAlign = 'left'

  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'))
}

export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [exporting, setExporting] = useState<FormatKey | null>(null)

  const handleExport = async (fmt: FormatKey) => {
    if (!cards.length) return
    setExporting(fmt); setShowPicker(false)
    try {
      const blob = await generate(cards, profileName, avatarUrl, accent, lang, fmt)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${profileName.replace(/\s+/g, '_')}_${fmt}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(null) }
  }

  const busy = exporting !== null

  return (
    <div style={{ position: 'relative', flex: '1 1 auto' }}>
      <button
        onClick={() => !busy && setShowPicker(p => !p)}
        disabled={busy || !cards.length}
        style={{
          width: '100%', background: busy ? '#ccc' : '#f0f0f0', color: '#333',
          border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700,
          fontSize: 13, cursor: busy || !cards.length ? 'not-allowed' : 'pointer',
          textAlign: 'center', minWidth: 100, transition: '0.2s',
        }}
      >
        {busy ? `⏳ ${FORMATS[exporting!].label}...` : `📸 ${lang === 'fr' ? 'Exporter' : 'Export'}`}
      </button>

      {showPicker && (
        <>
          <div onClick={() => setShowPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
            background: 'white', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            padding: 12, zIndex: 20, display: 'flex', gap: 8, minWidth: 220,
          }}>
            {(Object.entries(FORMATS) as [FormatKey, typeof FORMATS[FormatKey]][]).map(([key, fmt]) => (
              <button key={key} onClick={() => handleExport(key)}
                style={{
                  flex: 1, padding: '10px 8px', border: '2px solid #eee', borderRadius: 10,
                  background: '#fafafa', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#333',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: '0.15s',
                }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = accent; b.style.background = '#f0f4ff' }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = '#eee'; b.style.background = '#fafafa' }}
              >
                <span style={{ fontSize: 22 }}>{fmt.icon}</span>
                <span>{fmt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
