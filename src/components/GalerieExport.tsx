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
const HEADER_H = 100
const FOOTER_H = 40
const PAD = 32
const GAP = 12
const NAME_H = 36 // espace sous chaque carte (nom + variation)

const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="%23f0f0f0"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23bbb" font-size="32">?</text></svg>'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      const fb = new Image()
      fb.onload = () => resolve(fb)
      fb.src = PLACEHOLDER
    }
    img.src = src + (src.includes('?') ? '&' : '?') + '_export=1'
  })
}

// Calcule le meilleur nombre de colonnes pour que toutes les cartes
// rentrent dans la zone disponible avec la taille maximale possible
function bestLayout(n: number, availW: number, availH: number) {
  let bestCols = 1
  let bestCardW = 0

  for (let cols = 1; cols <= Math.min(n, 10); cols++) {
    const rows = Math.ceil(n / cols)
    const cardW = (availW - GAP * (cols - 1)) / cols
    const cardH = cardW * CARD_RATIO
    const totalH = rows * (cardH + NAME_H) + GAP * (rows - 1)
    if (totalH <= availH && cardW > bestCardW) {
      bestCardW = cardW
      bestCols = cols
    }
  }
  return bestCols
}

async function drawExport(
  cards: Card[],
  profileName: string,
  avatarUrl: string,
  accent: string,
  lang: string,
  fmt: FormatKey
): Promise<Blob> {
  const { w, h } = FORMATS[fmt]

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const availW = w - PAD * 2
  const availH = h - HEADER_H - FOOTER_H - PAD * 2

  const cols = bestLayout(cards.length, availW, availH)
  const rows = Math.ceil(cards.length / cols)
  const cardW = Math.floor((availW - GAP * (cols - 1)) / cols)
  const cardH = Math.floor(cardW * CARD_RATIO)

  // Centrage vertical de la grille dans la zone dispo
  const gridH = rows * (cardH + NAME_H) + GAP * (rows - 1)
  const gridOffsetY = HEADER_H + PAD + Math.max(0, (availH - gridH) / 2)

  // --- Fond ---
  ctx.fillStyle = '#f4f4f4'
  ctx.fillRect(0, 0, w, h)

  // --- Header ---
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, w, HEADER_H)

  // Avatar circulaire
  const avatarSize = 58
  const avatarX = PAD + avatarSize / 2
  const avatarY = HEADER_H / 2
  try {
    const avatar = await loadImage(avatarUrl)
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, PAD, avatarY - avatarSize / 2, avatarSize, avatarSize)
    ctx.restore()
  } catch {}

  // Nom
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(w * 0.022)}px Arial, sans-serif`
  ctx.fillText(profileName, PAD + avatarSize + 14, avatarY - 10)

  // Sous-titre
  ctx.font = `${Math.round(w * 0.013)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const sub = lang === 'fr'
    ? `${cards.length} carte${cards.length > 1 ? 's' : ''} · memorabilius.fr`
    : `${cards.length} card${cards.length > 1 ? 's' : ''} · memorabilius.fr`
  ctx.fillText(sub, PAD + avatarSize + 14, avatarY + 14)

  // Date (droite)
  ctx.textAlign = 'right'
  ctx.font = `${Math.round(w * 0.012)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), w - PAD, HEADER_H / 2)
  ctx.textAlign = 'left'

  // --- Images en parallèle ---
  const images = await Promise.all(cards.map(c => loadImage(c.f)))

  // --- Grille ---
  const tagFontSize = Math.max(8, Math.round(cardW * 0.09))
  const nameFontSize = Math.max(9, Math.round(cardW * 0.11))

  cards.forEach((card, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = PAD + col * (cardW + GAP)
    const y = gridOffsetY + row * (cardH + NAME_H + GAP)

    // Ombre
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4

    // Image
    ctx.drawImage(images[i], x, y, cardW, cardH)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Tags superposés
    const tags: { label: string; color: string }[] = []
    if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
    if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
    if (card.num) tags.push({ label: card.num, color: '#7b1fa2' })
    if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
    if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: '#003DA6' })

    ctx.font = `bold ${tagFontSize}px Arial, sans-serif`
    ctx.textBaseline = 'middle'
    let tagX = x + 4
    const tagY = y + cardH - tagFontSize * 2 - 4
    tags.slice(0, 3).forEach(tag => {
      const tw = ctx.measureText(tag.label).width + tagFontSize
      ctx.fillStyle = tag.color
      ctx.beginPath()
      ctx.roundRect(tagX, tagY, tw, tagFontSize + 6, 3)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(tag.label, tagX + tagFontSize / 2, tagY + (tagFontSize + 6) / 2)
      tagX += tw + 4
    })

    // Nom
    const nameY = y + cardH + 5
    ctx.fillStyle = '#111'
    ctx.font = `bold ${nameFontSize}px Arial, sans-serif`
    ctx.textBaseline = 'top'
    let name = card.n
    while (name.length > 1 && ctx.measureText(name).width > cardW - 4) name = name.slice(0, -1)
    if (name !== card.n) name += '…'
    ctx.fillText(name, x + 2, nameY)

    // Variation
    if (card.v) {
      ctx.fillStyle = accent
      ctx.font = `${Math.round(nameFontSize * 0.82)}px Arial, sans-serif`
      let v = card.v
      while (v.length > 1 && ctx.measureText(v).width > cardW - 4) v = v.slice(0, -1)
      if (v !== card.v) v += '…'
      ctx.fillText(v, x + 2, nameY + nameFontSize + 1)
    }
  })

  // --- Footer ---
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.12
  ctx.fillRect(0, h - FOOTER_H, w, FOOTER_H)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#888'
  ctx.font = `${Math.round(w * 0.012)}px Arial, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText('memorabilius.fr', w / 2, h - FOOTER_H / 2)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(), 'image/png')
  })
}

export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [exporting, setExporting] = useState<FormatKey | null>(null)

  const handleExport = async (fmt: FormatKey) => {
    if (cards.length === 0) return
    setExporting(fmt)
    setShowPicker(false)
    try {
      const blob = await drawExport(cards, profileName, avatarUrl, accent, lang, fmt)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${profileName.replace(/\s+/g, '_')}_${fmt}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  const busy = exporting !== null

  return (
    <div style={{ position: 'relative', flex: '1 1 auto' }}>
      <button
        onClick={() => !busy && setShowPicker(p => !p)}
        disabled={busy || cards.length === 0}
        style={{
          width: '100%',
          background: busy ? '#ccc' : '#f0f0f0',
          color: '#333', border: 'none', borderRadius: 8,
          padding: '10px 16px', fontWeight: 700, fontSize: 13,
          cursor: busy || cards.length === 0 ? 'not-allowed' : 'pointer',
          textAlign: 'center', minWidth: 100, transition: '0.2s',
        }}
      >
        {busy ? `⏳ ${FORMATS[exporting!].label}...` : `📸 ${lang === 'fr' ? 'Exporter' : 'Export'}`}
      </button>

      {showPicker && (
        <>
          {/* Fermer en cliquant ailleurs */}
          <div onClick={() => setShowPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
            background: 'white', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            padding: 12, zIndex: 20, display: 'flex', gap: 8, minWidth: 220,
          }}>
            {(Object.entries(FORMATS) as [FormatKey, typeof FORMATS[FormatKey]][]).map(([key, fmt]) => (
              <button
                key={key}
                onClick={() => handleExport(key)}
                style={{
                  flex: 1, padding: '10px 8px', border: '2px solid #eee',
                  borderRadius: 10, background: '#fafafa', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12, color: '#333',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: '0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = accent; (e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#eee'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
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
