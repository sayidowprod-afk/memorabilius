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
  a4:     { label: 'A4',    w: 1240, h: 1754 },
  a3:     { label: 'A3',    w: 1754, h: 2480 },
  square: { label: 'Carré', w: 1080, h: 1080 },
  story:  { label: 'Story', w: 1080, h: 1920 },
} as const
type FormatKey = keyof typeof FORMATS

interface Options {
  format: FormatKey
  bgType: 'white' | 'black' | 'custom'
  bgColor: string
  showName: boolean
  showInfo: boolean
  showVariation: boolean
  showBadges: boolean
}

const CARD_RATIO = 3.5 / 2.5
const HEADER_H = 90
const FOOTER_H = 34
const PAD = 22
const GAP = 8

const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="%23ddd"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23aaa" font-size="40">?</text></svg>'

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => { const fb = new Image(); fb.onload = () => resolve(fb); fb.src = PLACEHOLDER }
    img.src = src + (src.includes('?') ? '&' : '?') + '_e=1'
  })
}

function bestCols(n: number, availW: number, availH: number, hasOverlay: boolean): number {
  // Réserve de hauteur sous chaque carte si texte en dessous (pas overlay)
  const extraH = hasOverlay ? 0 : Math.round(availW / 10)
  let bestC = 1, bestArea = 0
  for (let c = 1; c <= Math.min(n, 12); c++) {
    const r = Math.ceil(n / c)
    const cardWfromW = (availW - GAP * (c - 1)) / c
    const cardHfromH = (availH - GAP * (r - 1) - extraH * r) / r
    const cardW = Math.min(cardWfromW, cardHfromH / CARD_RATIO)
    if (cardW * cardW * CARD_RATIO > bestArea) { bestArea = cardW * cardW * CARD_RATIO; bestC = c }
  }
  return bestC
}

async function generate(cards: Card[], profileName: string, avatarUrl: string, accent: string, lang: string, opts: Options): Promise<Blob> {
  const { w, h } = FORMATS[opts.format]
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!

  const bg = opts.bgType === 'white' ? '#ffffff' : opts.bgType === 'black' ? '#111111' : opts.bgColor
  const isDark = opts.bgType === 'black' || (opts.bgType === 'custom' && parseInt(opts.bgColor.slice(1), 16) < 0x888888 * 3)
  const textColor = isDark ? '#ffffff' : '#111111'
  const subColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'

  const hasText = opts.showName || opts.showInfo || opts.showVariation
  const hasOverlay = opts.showBadges && !hasText // badges seuls → overlay, sinon texte dessous
  const textBelow = hasText

  // Hauteur réservée sous chaque carte pour le texte
  const availW = w - PAD * 2
  const availH = h - HEADER_H - FOOTER_H - PAD * 2

  const cols = bestCols(cards.length, availW, availH, !textBelow)
  const rows = Math.ceil(cards.length / cols)

  // Taille de carte : remplit width ET height
  const cardWfromW = (availW - GAP * (cols - 1)) / cols
  const nameAreaH = textBelow ? Math.round(cardWfromW * 0.28) : 0
  const cardHfromH = (availH - GAP * (rows - 1) - nameAreaH * rows) / rows
  const cardW = Math.floor(Math.min(cardWfromW, cardHfromH / CARD_RATIO))
  const cardH = Math.floor(cardW * CARD_RATIO)
  const nameH = textBelow ? Math.round(cardW * 0.28) : 0

  const gridW = cols * cardW + GAP * (cols - 1)
  const gridH = rows * (cardH + nameH) + GAP * (rows - 1)
  const gridX = PAD + (availW - gridW) / 2
  const gridY = HEADER_H + PAD + (availH - gridH) / 2

  // === FOND ===
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // === HEADER ===
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, w, HEADER_H)

  const avS = Math.round(HEADER_H * 0.64)
  const avX = PAD + avS / 2, avY = HEADER_H / 2
  try {
    const av = await loadImg(avatarUrl)
    ctx.save(); ctx.beginPath(); ctx.arc(avX, avY, avS / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(av, PAD, avY - avS / 2, avS, avS); ctx.restore()
  } catch {}

  const tx = PAD + avS + 14
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(HEADER_H * 0.28)}px Arial, sans-serif`
  ctx.fillText(profileName, tx, avY - HEADER_H * 0.1)
  ctx.font = `${Math.round(HEADER_H * 0.168)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(`${cards.length} carte${cards.length > 1 ? 's' : ''} · memorabilius.fr`, tx, avY + HEADER_H * 0.18)
  ctx.textAlign = 'right'; ctx.font = `${Math.round(HEADER_H * 0.15)}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), w - PAD, avY)
  ctx.textAlign = 'left'

  // === IMAGES ===
  const images = await Promise.all(cards.map(c => loadImg(c.f)))

  const tagH = Math.max(12, Math.round(cardW * 0.08))
  const nameSize = Math.max(9, Math.round(cardW * 0.095))
  const varSize = Math.max(8, Math.round(cardW * 0.078))
  const infoSize = Math.max(7, Math.round(cardW * 0.068))

  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = Math.round(gridX + col * (cardW + GAP))
    const y = Math.round(gridY + row * (cardH + nameH + GAP))

    // Carte
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
    ctx.drawImage(images[i], x, y, cardW, cardH)
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    // Badges en overlay (coin bas-gauche de l'image)
    if (opts.showBadges) {
      const tags: { label: string; color: string }[] = []
      if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
      if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
      if (card.num) tags.push({ label: card.num, color: '#7b1fa2' })
      if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
      if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: accent })

      if (tags.length > 0) {
        ctx.font = `bold ${Math.round(tagH * 0.72)}px Arial, sans-serif`
        ctx.textBaseline = 'middle'
        let tagX = x + 4
        const tagY = y + cardH - tagH - 5
        tags.slice(0, 4).forEach(tag => {
          const tw = ctx.measureText(tag.label).width + tagH * 0.9
          ctx.fillStyle = tag.color
          ctx.beginPath(); ctx.roundRect(tagX, tagY, tw, tagH, 3); ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(tag.label, tagX + tagH * 0.45, tagY + tagH / 2)
          tagX += tw + 3
        })
      }
    }

    // Texte sous la carte
    if (textBelow) {
      let lineY = y + cardH + 5
      ctx.textBaseline = 'top'

      if (opts.showName && card.n) {
        ctx.fillStyle = textColor
        ctx.font = `bold ${nameSize}px Arial, sans-serif`
        let name = card.n
        while (name.length > 1 && ctx.measureText(name).width > cardW - 4) name = name.slice(0, -1)
        if (name !== card.n) name += '…'
        ctx.fillText(name, x + 2, lineY)
        lineY += nameSize + 2
      }

      if (opts.showVariation && card.v) {
        ctx.fillStyle = accent
        ctx.font = `${varSize}px Arial, sans-serif`
        let v = card.v
        while (v.length > 1 && ctx.measureText(v).width > cardW - 4) v = v.slice(0, -1)
        if (v !== card.v) v += '…'
        ctx.fillText(v, x + 2, lineY)
        lineY += varSize + 2
      }

      if (opts.showInfo && (card.y || card.br)) {
        ctx.fillStyle = subColor
        ctx.font = `${infoSize}px Arial, sans-serif`
        const info = [card.y, card.br].filter(Boolean).join(' · ')
        let inf = info
        while (inf.length > 1 && ctx.measureText(inf).width > cardW - 4) inf = inf.slice(0, -1)
        if (inf !== info) inf += '…'
        ctx.fillText(inf, x + 2, lineY)
      }
    }
  })

  // === FOOTER ===
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  ctx.fillRect(0, h - FOOTER_H, w, FOOTER_H)
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'
  ctx.font = `${Math.round(FOOTER_H * 0.4)}px Arial, sans-serif`
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText('memorabilius.fr', w / 2, h - FOOTER_H / 2)
  ctx.textAlign = 'left'

  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'))
}

// ─── UI ────────────────────────────────────────────────────────────────────────

const ROW = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as const
const SECTION_LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#888', marginBottom: 8, display: 'block' }

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#333' }}>
      <div onClick={() => onChange(!on)} style={{
        width: 36, height: 20, borderRadius: 10, background: on ? '#003DA6' : '#ddd',
        position: 'relative', transition: '0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
          borderRadius: '50%', background: '#fff', transition: '0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label}
    </label>
  )
}

export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [opts, setOpts] = useState<Options>({
    format: 'a4',
    bgType: 'white',
    bgColor: '#1a1a2e',
    showName: true,
    showInfo: true,
    showVariation: true,
    showBadges: true,
  })

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts(o => ({ ...o, [k]: v }))

  const handleExport = async () => {
    if (!cards.length) return
    setExporting(true)
    try {
      const blob = await generate(cards, profileName, avatarUrl, accent, lang, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${profileName.replace(/\s+/g, '_')}_${opts.format}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!cards.length}
        style={{
          background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8,
          padding: '10px 16px', fontWeight: 700, fontSize: 13,
          cursor: !cards.length ? 'not-allowed' : 'pointer',
          flex: '1 1 auto', textAlign: 'center', minWidth: 100,
        }}
      >
        📸 {lang === 'fr' ? 'Exporter' : 'Export'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

            {/* Header popup */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>📸 {lang === 'fr' ? 'Exporter la galerie' : 'Export gallery'}</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Format */}
              <div>
                <span style={SECTION_LABEL}>{lang === 'fr' ? 'Format' : 'Format'}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {(Object.entries(FORMATS) as [FormatKey, { label: string }][]).map(([key, f]) => (
                    <button key={key} onClick={() => set('format', key)}
                      style={{
                        padding: '8px 4px', border: `2px solid ${opts.format === key ? '#003DA6' : '#eee'}`,
                        borderRadius: 8, background: opts.format === key ? '#f0f4ff' : '#fafafa',
                        fontWeight: 700, fontSize: 12, color: opts.format === key ? '#003DA6' : '#555',
                        cursor: 'pointer', transition: '0.15s',
                      }}>{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Fond */}
              <div>
                <span style={SECTION_LABEL}>{lang === 'fr' ? 'Fond' : 'Background'}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {(['white', 'black'] as const).map(t => (
                    <button key={t} onClick={() => set('bgType', t)}
                      style={{
                        flex: 1, padding: '8px', border: `2px solid ${opts.bgType === t ? '#003DA6' : '#eee'}`,
                        borderRadius: 8, background: t === 'white' ? '#fff' : '#111',
                        color: t === 'white' ? '#333' : '#fff', fontWeight: 700, fontSize: 12,
                        cursor: 'pointer', transition: '0.15s',
                      }}>
                      {t === 'white' ? '⬜ Blanc' : '⬛ Noir'}
                    </button>
                  ))}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => set('bgType', 'custom')}
                      style={{
                        width: 42, height: 38, border: `2px solid ${opts.bgType === 'custom' ? '#003DA6' : '#eee'}`,
                        borderRadius: 8, background: opts.bgColor, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }} title="Couleur personnalisée">🎨</button>
                    {opts.bgType === 'custom' && (
                      <input type="color" value={opts.bgColor} onChange={e => set('bgColor', e.target.value)}
                        style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Infos à afficher */}
              <div>
                <span style={SECTION_LABEL}>{lang === 'fr' ? 'Informations à afficher' : 'Display options'}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Toggle on={opts.showName} onChange={v => set('showName', v)} label={lang === 'fr' ? 'Nom du joueur' : 'Player name'} />
                  <Toggle on={opts.showVariation} onChange={v => set('showVariation', v)} label={lang === 'fr' ? 'Variation / Parallèle' : 'Variation / Parallel'} />
                  <Toggle on={opts.showInfo} onChange={v => set('showInfo', v)} label={lang === 'fr' ? 'Année & Collection' : 'Year & Brand'} />
                  <Toggle on={opts.showBadges} onChange={v => set('showBadges', v)} label="RC · AUTO · PATCH · Grade" />
                </div>
              </div>

              {/* Résumé */}
              <p style={{ fontSize: 11, color: '#bbb', margin: 0, textAlign: 'center' }}>
                {cards.length} carte{cards.length > 1 ? 's' : ''} · {FORMATS[opts.format].label}
              </p>

              {/* Bouton export */}
              <button onClick={handleExport} disabled={exporting}
                style={{
                  background: exporting ? '#ccc' : '#003DA6', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '14px', fontWeight: 800, fontSize: 15,
                  cursor: exporting ? 'not-allowed' : 'pointer', width: '100%', transition: '0.2s',
                }}>
                {exporting ? (lang === 'fr' ? '⏳ Génération...' : '⏳ Generating...') : (lang === 'fr' ? '⬇️ Télécharger' : '⬇️ Download')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
