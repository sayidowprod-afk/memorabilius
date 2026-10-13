'use client'
import { useEffect, useRef, useState } from 'react'
import { uploadGuideImage } from '@/lib/guideUpload'
import { toast } from '@/lib/toast'

// Couverture de guide 1200x630 composee dans le navigateur : logo Memorabilius, nom de la collection en Surfquest, fond a la couleur principale de la boite,
// quelques cartes en eventail a gauche, boite (PNG fourni par l'admin) a droite. Aucune carte n'est arrondie : bords francs.
const W = 1200, H = 630

function loadImg(src: string, cors = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

// couleur dominante d'une image (en ignorant transparence, blancs, noirs et gris) : le seau de teinte le plus « charge » en couleur
function dominantColor(img: HTMLImageElement): [number, number, number] {
  const s = 64
  const c = document.createElement('canvas')
  const k = Math.min(1, s / Math.max(img.width, img.height))
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0, c.width, c.height)
  const px = g.getImageData(0, 0, c.width, c.height).data
  const buckets = Array.from({ length: 36 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
  let ar = 0, ag = 0, ab = 0, an = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue
    const r = px[i], gg = px[i + 1], b = px[i + 2]
    ar += r; ag += gg; ab += b; an++
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx
    if (mn > 235 || mx < 30 || sat < 0.22) continue
    let h = 0
    const d = mx - mn
    if (mx === r) h = ((gg - b) / d) % 6
    else if (mx === gg) h = (b - r) / d + 2
    else h = (r - gg) / d + 4
    const idx = Math.floor((((h * 60) + 360) % 360) / 10)
    const wgt = sat * (mx / 255)
    const bk = buckets[idx]
    bk.w += wgt; bk.r += r * wgt; bk.g += gg * wgt; bk.b += b * wgt
  }
  const best = buckets.sort((a, b) => b.w - a.w)[0]
  if (best.w > 0) return [best.r / best.w, best.g / best.w, best.b / best.w]
  return an ? [ar / an, ag / an, ab / an] : [0, 61, 166]
}

const mixc = (c: [number, number, number], t: number, to = 0): string => `rgb(${c.map(v => Math.round(v + (to - v) * t)).join(',')})`

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, maxLines: number) {
  for (let s = size; s >= 26; s -= 2) {
    ctx.font = `400 ${s}px Surfquest, Impact, 'Arial Narrow', sans-serif`
    const words = text.toUpperCase().split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w
      if (ctx.measureText(t).width <= maxW || !cur) cur = t
      else { lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { lines, size: s }
  }
  return { lines: [text.toUpperCase()], size: 26 }
}

export default function GuideCoverMaker({ defaultName, cardPool, onDone, dark }: { defaultName: string; cardPool: string[]; onDone: (url: string) => void; dark: boolean }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [boxUrl, setBoxUrl] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [seed, setSeed] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<string | null>(null)

  useEffect(() => { if (!open) setName(defaultName) }, [defaultName, open])
  // cartes par defaut : 5 images variees du guide (on saute de l'une a l'autre pour ne pas prendre cinq fois la meme famille)
  useEffect(() => {
    if (!open || picked.length) return
    const step = Math.max(1, Math.floor(cardPool.length / 5))
    const out: string[] = []
    for (let i = 0; i < cardPool.length && out.length < 5; i++) { const u = cardPool[(seed + i * step) % cardPool.length]; if (!out.includes(u)) out.push(u) }
    setPicked(out)
  }, [open, cardPool, picked.length, seed])
  useEffect(() => () => { if (boxRef.current) URL.revokeObjectURL(boxRef.current) }, [])

  const draw = async () => {
    const cv = canvasRef.current
    if (!cv) return
    setError('')
    cv.width = W; cv.height = H
    const ctx = cv.getContext('2d')!
    try { await document.fonts.load("40px Surfquest") } catch { /* police par defaut */ }
    const box = boxUrl ? await loadImg(boxUrl, false).catch(() => null) : null
    const logo = await loadImg('/memorabilius-logo-white-sm.png', false).catch(() => null)
    const cards = (await Promise.all(picked.map(u => loadImg(u).catch(() => null)))).filter((x): x is HTMLImageElement => !!x)
    if (picked.length && !cards.length) setError('Les photos de cartes ne se chargent pas (restriction du navigateur) : réessaie après la copie des photos dans le guide.')

    // fond : couleur principale de la boite (marine Memorabilius sans boite)
    let base: [number, number, number] = [0, 61, 166]
    if (box) {
      base = dominantColor(box)
      const lum = (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 255
      if (lum > 0.62) base = base.map(v => v * 0.78) as [number, number, number]
    }
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, mixc(base, 0.62)); bg.addColorStop(0.5, mixc(base, 0.12)); bg.addColorStop(1, mixc(base, 0.45))
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W * 0.72, H * 0.5, 20, W * 0.72, H * 0.5, 420)
    glow.addColorStop(0, 'rgba(255,255,255,.22)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

    const shadow = (blur: number, oy: number) => { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy }
    const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0 }

    // boite a droite
    if (box) {
      const maxW = 500, maxH = 500
      const k = Math.min(maxW / box.width, maxH / box.height)
      const bw = box.width * k, bh = box.height * k
      ctx.save(); ctx.translate(W - 60 - bw / 2, H / 2 + 22); ctx.rotate(0.05)
      shadow(36, 18); ctx.drawImage(box, -bw / 2, -bh / 2, bw, bh); noShadow(); ctx.restore()
    }
    // cartes en eventail a gauche (bords francs)
    const n = cards.length
    const areaX = 34, areaW = box ? 610 : 1130
    const ch = box ? 300 : 340
    cards.forEach((img, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const asp = Math.min(1.45, Math.max(0.55, img.width / img.height))
      const cw = Math.min(ch * asp, 290)
      const chh = cw / asp
      const cx = areaX + cw / 2 + t * (areaW - cw)
      const cy = H - 52 - chh / 2 - Math.sin(t * Math.PI) * 24
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((t - 0.5) * 0.34)
      shadow(22, 10); ctx.drawImage(img, -cw / 2, -chh / 2, cw, chh); noShadow(); ctx.restore()
    })

    // logo + titre en haut a gauche, contour noir (comme les couvertures existantes)
    const outline = (draw: (dx: number, dy: number) => void, r = 4) => { for (let a = 0; a < 16; a++) draw(Math.cos(a / 16 * Math.PI * 2) * r, Math.sin(a / 16 * Math.PI * 2) * r) }
    if (logo) {
      const lw = 330, lh = lw * logo.height / logo.width
      const tmp = document.createElement('canvas'); tmp.width = Math.ceil(lw) + 16; tmp.height = Math.ceil(lh) + 16
      const tg = tmp.getContext('2d')!
      const black = document.createElement('canvas'); black.width = Math.ceil(lw); black.height = Math.ceil(lh)
      const bgc = black.getContext('2d')!; bgc.drawImage(logo, 0, 0, lw, lh); bgc.globalCompositeOperation = 'source-in'; bgc.fillStyle = '#000'; bgc.fillRect(0, 0, lw, lh)
      outline((dx, dy) => tg.drawImage(black, 8 + dx, 8 + dy), 4)
      tg.drawImage(logo, 8, 8, lw, lh)
      ctx.drawImage(tmp, 28, 22)
    }
    const f = fitText(ctx, name || ' ', box ? 560 : 900, 52, 3)
    ctx.font = `400 ${f.size}px Surfquest, Impact, 'Arial Narrow', sans-serif`
    ctx.textBaseline = 'top'; ctx.lineJoin = 'round'; ctx.letterSpacing = '1px'
    f.lines.forEach((l, i) => {
      const y = 112 + i * (f.size * 1.02)
      ctx.lineWidth = 9; ctx.strokeStyle = '#000'; ctx.strokeText(l, 40, y)
      ctx.fillStyle = '#fff'; ctx.fillText(l, 40, y)
    })
    ctx.letterSpacing = '0px'
  }

  useEffect(() => { if (open) draw() }, [open, name, boxUrl, picked])

  const save = async () => {
    const cv = canvasRef.current
    if (!cv) return
    setBusy(true)
    const blob: Blob | null = await new Promise(res => { try { cv.toBlob(b => res(b), 'image/jpeg', 0.92) } catch { res(null) } })
    if (!blob) { toast.error('Impossible d’exporter l’image (photo bloquée par le navigateur)'); setBusy(false); return }
    const url = await uploadGuideImage(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), 'covers/')
    setBusy(false)
    if (url) { onDone(url); toast.success('Couverture enregistrée pour ce guide'); setOpen(false) }
  }

  const border = dark ? '#2a2a2a' : '#dde3ee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...btn, background: '#003DA6', color: 'white' }}>🖼️ Générer la couverture</button>
      {open && (
        <div style={{ marginTop: 10, border: `1px solid ${border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Nom de la collection (texte de la couverture)</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Photo de la boîte (PNG, de préférence sans fond)</label>
            <input type="file" accept="image/png,image/webp,image/jpeg" onChange={e => {
              const f = e.target.files?.[0]
              if (boxRef.current) URL.revokeObjectURL(boxRef.current)
              const u = f ? URL.createObjectURL(f) : null
              boxRef.current = u; setBoxUrl(u)
            }} />
            {!boxUrl && <p style={{ fontSize: 11, color: sub, margin: '4px 0 0' }}>Sans boîte : fond marine et cartes réparties sur toute la largeur.</p>}
          </div>
          {cardPool.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Cartes de la couverture ({picked.length}/6) · clique pour ajouter / retirer</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto' }}>
                {cardPool.slice(0, 80).map(u => {
                  const on = picked.includes(u)
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" onClick={() => setPicked(p => (on ? p.filter(x => x !== u) : p.length >= 6 ? p : [...p, u]))}
                      style={{ height: 70, borderRadius: 0, cursor: 'pointer', outline: on ? '3px solid #003DA6' : '1px solid ' + border, opacity: on ? 1 : 0.55 }} />
                  )
                })}
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 600, aspectRatio: `${W} / ${H}`, border: `1px solid ${border}`, display: 'block' }} />
          {error && <p style={{ fontSize: 12, color: '#e74c3c', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} onClick={save} style={{ ...btn, background: '#27ae60', color: 'white', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enregistrement…' : '✓ Utiliser comme couverture'}</button>
            <button type="button" onClick={() => { setSeed(x => x + 1); setPicked([]) }} style={{ ...btn, background: 'transparent', color: text, border: `1.5px solid ${border}` }}>↻ Autres cartes</button>
          </div>
        </div>
      )}
    </div>
  )
}
