import { createCanvas, loadImage, type Image } from '@napi-rs/canvas'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

// Rendu cote serveur d'une carte qui tourne en boucle sans fin, pour la
// commande Discord /carte-gif -- juste la carte (pas d'infos incrustees,
// celles-ci restent dans l'embed Discord). Reprend le meme effet visuel
// que l'export video cote client (CardVideoExport.tsx) -- un flip 2D via
// scaleX(cos(angle)), pas de vraie 3D -- mais rendu ici avec @napi-rs/canvas
// (canvas natif, marche en environnement serverless sans navigateur) et
// encode en GIF anime avec gifenc (pur JS, pas de dependance native).

const W = 360
const H = Math.round(W * 3.5 / 2.5) // ratio carte a collectionner standard
const FRAMES = 60
const DELAY_MS = 65  // ~3,9s par rotation complete -- meme nombre de frames (fluidite inchangee), juste chaque frame affichee plus longtemps

async function fetchImage(url: string): Promise<Image> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image injoignable (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  return loadImage(buf)
}

export async function renderCardSpinGif(frontUrl: string, backUrl: string | null): Promise<Buffer> {
  const [front, back] = await Promise.all([
    fetchImage(frontUrl),
    backUrl ? fetchImage(backUrl).catch(() => null) : Promise.resolve(null),
  ])
  const backImg = back || front // pas de verso connu -- redessine le recto plutot que de rien afficher

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const gif = GIFEncoder()

  // Certaines cartes sont horizontales (format paysage) -- une taille de boite
  // fixe en portrait (3.5/2.5) les etirait/coupait. On se cale sur le vrai
  // ratio de l'image chargee plutot que de supposer portrait partout.
  const MAX_CARD_W = W * 0.8
  const MAX_CARD_H = H * 0.8
  const imgRatio = front.width / front.height
  const boxRatio = MAX_CARD_W / MAX_CARD_H
  const CARD_W = imgRatio > boxRatio ? MAX_CARD_W : MAX_CARD_H * imgRatio
  const CARD_H = imgRatio > boxRatio ? MAX_CARD_W / imgRatio : MAX_CARD_H
  const cx = W / 2
  const cy = H / 2

  for (let i = 0; i < FRAMES; i++) {
    const t = i / FRAMES
    const angle = t * Math.PI * 2
    const scaleX = Math.cos(angle)
    const showBack = scaleX < 0
    const face = showBack ? backImg : front
    const cardW = Math.max(2, CARD_W * Math.abs(scaleX))
    const cardH = CARD_H

    // Fond -- degrade bleu de la charte, transparent aurait mal rendu sur
    // certains clients Discord (mode sombre/clair) donc fond plein assume.
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0d1230')
    bg.addColorStop(1, '#001c4d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Ombre portee
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH)
    ctx.restore()

    // Carte
    ctx.drawImage(face as any, cx - cardW / 2, cy - cardH / 2, cardW, cardH)

    // Liseré + reflet diagonal pour donner du volume
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH)

    if (cardW > 6) {
      const gloss = ctx.createLinearGradient(cx - cardW / 2, cy - cardH / 2, cx + cardW / 2, cy + cardH / 2)
      gloss.addColorStop(0, 'rgba(255,255,255,0)')
      gloss.addColorStop(0.5, 'rgba(255,255,255,0.14)')
      gloss.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gloss
      ctx.fillRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH)
    }

    // Éclat de tranche au moment du flip (carte vue de profil)
    if (Math.abs(scaleX) < 0.12) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - Math.abs(scaleX) / 0.12)})`
      ctx.fillRect(cx - 2, cy - cardH / 2, 4, cardH)
    }

    const { data } = ctx.getImageData(0, 0, W, H)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, W, H, { palette, delay: DELAY_MS })
  }

  gif.finish()
  return Buffer.from(gif.bytes())
}
