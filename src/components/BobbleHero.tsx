'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import type { BobbleFig } from '@/lib/bobbleheadsServer'

// Bobblehead d'un joueur : tête de face posée sur un corps aux couleurs de son équipe. La tête oscille autour de son menton
// (ressort amorti, mêmes réglages que la page d'essai) au survol, au clic ou au toucher, et se remet à bouger d'elle-même de temps en temps.
// Hauteur totale identique pour tous les joueurs (haut de la tête → chaussures).
// Corps d'équipe : la couleur de peau du corps est ramenée à celle de la tête et le numéro est écrit dessus (même rendu que la page de contrôle des têtes).

const EAR_T = 224      // largeur d'oreille à oreille de départ (px)
const SPAN_T = 190     // largeur des épaules de départ (px)
const OVERLAP = 42     // recouvrement du menton sur le haut du corps (px)
const FIG_T = 560      // hauteur totale de référence (px) : la figurine est ensuite mise à l'échelle de `height`

const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })

// Corps d'équipe → image finale (peau teintée + numéro), en data URL
async function composeBody(fig: BobbleFig): Promise<string | null> {
  const b = fig.body, img = await loadImg(b.src); if (!img) return null
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d'); if (!g) return null
  g.drawImage(img, 0, 0)
  const skin = fig.head.skin
  if (skin) {
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data
    const ci = (Math.round(c.height * 0.25) * c.width + Math.round(c.width * 0.5)) * 4, jr = px[ci], jg = px[ci + 1], jb = px[ci + 2]
    const isSkin = (i: number, y: number) => {
      if (px[i + 3] < 40 || y > c.height * 0.8) return false
      const r = px[i], gg = px[i + 1], bl = px[i + 2], mx = Math.max(r, gg, bl), mn = Math.min(r, gg, bl)
      if (mx - mn < 28 || r < gg || r < bl) return false
      if (Math.abs(r - jr) + Math.abs(gg - jg) + Math.abs(bl - jb) < 90) return false
      const h = (60 * (((gg - bl) / (mx - mn)) % 6) + 360) % 360, sat = (mx - mn) / mx
      return h >= 10 && h <= 34 && sat >= 0.3 && sat <= 0.72
    }
    let sum = 0, n = 0
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (isSkin(i, y)) { sum += 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]; n++ } }
    const avg = n ? sum / n : 100
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4; if (!isSkin(i, y)) continue
      const k = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / avg
      px[i] = Math.min(255, skin[0] * k); px[i + 1] = Math.min(255, skin[1] * k); px[i + 2] = Math.min(255, skin[2] * k)
    }
    g.putImageData(d, 0, 0)
  }
  if (b.num) {
    try { await document.fonts.load('100px Surfquest') } catch { /* police par défaut */ }
    const fs = c.height * (b.num.length > 1 ? 0.21 : 0.24)
    g.font = `${fs}px Surfquest, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = Math.max(2, fs * 0.1)
    const nx = c.width / 2 + c.width * 0.035 / 2, ny = c.height * 0.155
    g.strokeStyle = b.numStroke || '#000'; g.strokeText(b.num, nx, ny)
    g.fillStyle = b.numFill || '#fff'; g.fillText(b.num, nx, ny)
  }
  return c.toDataURL('image/png')
}

export default function BobbleHero({ fig, name, height = 430 }: { fig: BobbleFig; name: string; height?: number }) {
  const headRef = useRef<HTMLDivElement>(null)
  const st = useRef({ a: 0, w: 0, last: 0 })
  const [reduced, setReduced] = useState(false)
  const [bodySrc, setBodySrc] = useState<string | null>(fig.body.team ? null : fig.body.src)

  useEffect(() => {
    try { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch { /* rien */ }
  }, [])

  useEffect(() => {
    if (!fig.body.team) { setBodySrc(fig.body.src); return }
    let off = false
    composeBody(fig).then(u => { if (!off) setBodySrc(u || fig.body.src) })
    return () => { off = true }
  }, [fig])

  useEffect(() => {
    if (reduced) return
    // ressort : accélération = -k·angle - c·vitesse (angle en degrés)
    const K = 95, C = 3.4
    st.current.last = performance.now()
    const tick = setInterval(() => {
      const s = st.current
      const now = performance.now()
      const dt = Math.min(0.05, (now - s.last) / 1000); s.last = now
      s.w += (-K * s.a - C * s.w) * dt
      s.a += s.w * dt
      if (headRef.current) headRef.current.style.transform = `translateX(${Math.sin(s.a * Math.PI / 180) * 14}px) rotate(${s.a}deg)`
    }, 16)
    // petites secousses régulières pour que la figurine reste vivante
    const idle = setInterval(() => { st.current.w += (Math.random() < 0.5 ? -1 : 1) * 38 }, 3600)
    const first = setTimeout(() => { st.current.w += 160 }, 400) // petite impulsion à l'arrivée
    return () => { clearInterval(tick); clearInterval(idle); clearTimeout(first) }
  }, [reduced])

  const bump = (power: number) => { st.current.w += (Math.random() < 0.5 ? -1 : 1) * power }

  // mêmes calculs que la page d'essai, à l'échelle FIG_T puis ramenés à `height`
  const hs0 = EAR_T / fig.head.ear
  const bs0 = SPAN_T / fig.body.span
  const total0 = fig.head.h * hs0 + fig.body.h * bs0 - OVERLAP
  const f = (FIG_T / total0) * (height / FIG_T)
  const headW = fig.head.w * hs0 * f
  const bodyH = fig.body.h * bs0 * f
  const bodyW = fig.body.w * bs0 * f
  const overlap = OVERLAP * f
  const lift = 8 * (height / FIG_T)
  const stageW = Math.max(headW, bodyW) + 40

  return (
    <div
      role="img" aria-label={`Bobblehead de ${name}`}
      onMouseEnter={() => bump(70)} onClick={() => bump(240)} onTouchStart={() => bump(240)}
      style={{ position: 'relative', width: stageW, height, flexShrink: 0, cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* ombre très douce sous les chaussures (pas de socle) */}
      <div aria-hidden style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 210 * (height / FIG_T), height: 22 * (height / FIG_T), borderRadius: '50%', background: 'rgba(0,0,0,.38)', filter: 'blur(9px)', zIndex: 1 }} />
      {bodySrc && <img src={bodySrc} alt="" draggable={false} width={bodyW} height={bodyH}
        style={{ position: 'absolute', left: '50%', bottom: lift, transform: 'translateX(-50%)', zIndex: 2, height: bodyH, width: bodyW, display: 'block', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.35))', background: 'none', animation: 'none' }} />}
      <div ref={headRef} style={{ position: 'absolute', left: '50%', bottom: bodyH + lift - overlap, marginLeft: -headW / 2, width: headW, transformOrigin: '50% 88%', zIndex: 4 }}>
        <img src={fig.headSrc} alt="" draggable={false} width={headW}
          style={{ width: headW, height: 'auto', display: 'block', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,.35))', background: 'none', animation: 'none' }} />
      </div>
    </div>
  )
}
