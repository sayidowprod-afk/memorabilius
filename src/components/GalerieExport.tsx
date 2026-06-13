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

const CANVAS_W = 1200
const PAD = 36
const GAP = 14
const HEADER_H = 90
const FOOTER_H = 44
const NAME_H = 38
const CARD_RATIO = 3.5 / 2.5

function getCols(n: number) {
  if (n <= 4) return 2
  if (n <= 9) return 3
  if (n <= 20) return 4
  return 5
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      // Image placeholder si CORS bloque
      const fallback = new Image()
      fallback.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="%23f0f0f0"/><text x="50%25" y="50%25" text-anchor="middle" fill="%23bbb" font-size="28">?</text></svg>'
      fallback.onload = () => resolve(fallback)
    }
    img.src = src + (src.includes('?') ? '&' : '?') + 'export=true'
  })
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (cards.length === 0) return
    setExporting(true)

    try {
      const cols = getCols(cards.length)
      const cardW = Math.floor((CANVAS_W - PAD * 2 - GAP * (cols - 1)) / cols)
      const cardH = Math.floor(cardW * CARD_RATIO)
      const rows = Math.ceil(cards.length / cols)
      const canvasH = HEADER_H + PAD + rows * (cardH + NAME_H + GAP) + PAD + FOOTER_H

      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_W
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')!

      // Fond blanc
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_W, canvasH)

      // Bande header colorée
      const rgb = hexToRgb(accent.startsWith('#') ? accent : '#003DA6')
      ctx.fillStyle = accent
      ctx.fillRect(0, 0, CANVAS_W, HEADER_H)

      // Avatar
      try {
        const avatar = await loadImage(avatarUrl)
        ctx.save()
        ctx.beginPath()
        ctx.arc(PAD + 30, HEADER_H / 2, 30, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(avatar, PAD, HEADER_H / 2 - 30, 60, 60)
        ctx.restore()
      } catch {}

      // Nom du collectionneur
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px Inter, Arial, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(profileName, PAD + 76, HEADER_H / 2 - 10)

      // Sous-titre
      ctx.font = '15px Inter, Arial, sans-serif'
      ctx.fillStyle = `rgba(255,255,255,0.75)`
      const subtitle = lang === 'fr'
        ? `${cards.length} carte${cards.length > 1 ? 's' : ''} · memorabilius.fr`
        : `${cards.length} card${cards.length > 1 ? 's' : ''} · memorabilius.fr`
      ctx.fillText(subtitle, PAD + 76, HEADER_H / 2 + 16)

      // Date
      ctx.textAlign = 'right'
      ctx.font = '13px Inter, Arial, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), CANVAS_W - PAD, HEADER_H / 2)
      ctx.textAlign = 'left'

      // Chargement des images en parallèle
      const images = await Promise.all(cards.map(c => loadImage(c.f)))

      // Dessin des cartes
      cards.forEach((card, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = PAD + col * (cardW + GAP)
        const y = HEADER_H + PAD + row * (cardH + NAME_H + GAP)

        // Ombre légère
        ctx.shadowColor = 'rgba(0,0,0,0.10)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 3

        // Image carte
        ctx.drawImage(images[i], x, y, cardW, cardH)
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // Tags (RC, AUTO, etc.)
        const tags: { label: string; color: string }[] = []
        if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
        if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
        if (card.num) tags.push({ label: card.num, color: '#7b1fa2' })
        if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
        if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: '#003DA6' })

        let tagX = x + 4
        const tagY = y + cardH - 22
        ctx.font = 'bold 9px Inter, Arial, sans-serif'
        tags.slice(0, 3).forEach(tag => {
          const tw = ctx.measureText(tag.label).width + 8
          ctx.fillStyle = tag.color
          ctx.beginPath()
          ctx.roundRect(tagX, tagY, tw, 16, 3)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(tag.label, tagX + 4, tagY + 11)
          tagX += tw + 4
        })

        // Nom
        const nameY = y + cardH + 6
        ctx.fillStyle = '#121212'
        ctx.font = 'bold 11px Inter, Arial, sans-serif'
        ctx.textBaseline = 'top'
        const maxW = cardW - 4
        let name = card.n
        while (ctx.measureText(name).width > maxW && name.length > 0) name = name.slice(0, -1)
        if (name !== card.n) name += '…'
        ctx.fillText(name, x + 2, nameY)

        // Variation
        if (card.v) {
          ctx.fillStyle = accent
          ctx.font = '9px Inter, Arial, sans-serif'
          let variant = card.v
          while (ctx.measureText(variant).width > maxW && variant.length > 0) variant = variant.slice(0, -1)
          if (variant !== card.v) variant += '…'
          ctx.fillText(variant, x + 2, nameY + 14)
        }
      })

      // Footer
      const footerY = canvasH - FOOTER_H
      ctx.fillStyle = '#f8f8f8'
      ctx.fillRect(0, footerY, CANVAS_W, FOOTER_H)
      ctx.fillStyle = '#bbb'
      ctx.font = '13px Inter, Arial, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText('memorabilius.fr — La plateforme des collectionneurs de cartes', CANVAS_W / 2, footerY + FOOTER_H / 2)
      ctx.textAlign = 'left'

      // Téléchargement
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${profileName.replace(/\s+/g, '_')}_collection.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')

    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || cards.length === 0}
      style={{
        background: exporting ? '#ccc' : '#f0f0f0',
        color: '#333', border: 'none', borderRadius: 8,
        padding: '10px 16px', fontWeight: 700, fontSize: 13,
        cursor: exporting || cards.length === 0 ? 'not-allowed' : 'pointer',
        flex: '1 1 auto', textAlign: 'center', minWidth: 100,
        transition: '0.2s',
      }}
    >
      {exporting ? '⏳ Export...' : `📸 ${lang === 'fr' ? 'Exporter' : 'Export'}`}
    </button>
  )
}
