import { RARITY_COLOR, RARITY_NAME, type PackCard } from '@/lib/packs'

// Affiche d'un tirage (1080 x 1350) : les cartes bien présentées, à envoyer sur Discord ou TikTok.
async function bmp(url: string): Promise<ImageBitmap | null> {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? await createImageBitmap(await r.blob()) : null } catch { return null }
}
export async function makePoster(cards: PackCard[], pseudo: string): Promise<Blob | null> {
  const W = 1080, H = 1350
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d'); if (!x) return null
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d2257'); g.addColorStop(1, '#030816'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  const best = cards.reduce((m: number, k) => Math.max(m, k.rarity), 1) as 1 | 2 | 3 | 4 | 5
  const glow = x.createRadialGradient(W / 2, 560, 0, W / 2, 560, 760); glow.addColorStop(0, RARITY_COLOR[best] + '55'); glow.addColorStop(1, 'transparent'); x.fillStyle = glow; x.fillRect(0, 0, W, H)
  try { await document.fonts.load("400 60px Surfquest") } catch { /* police de repli */ }
  const DISPLAY = "Surfquest, Impact, 'Arial Narrow', sans-serif"
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.font = `400 86px ${DISPLAY}`; x.fillText(`${pseudo.toUpperCase().slice(0, 18)} A OUVERT UN PACK`, W / 2, 120, W - 80)
  x.font = `800 30px system-ui, sans-serif`; x.fillStyle = RARITY_COLOR[best]; x.fillText(`MEILLEURE CARTE : ${RARITY_NAME[best].toUpperCase()}`, W / 2, 175)
  const imgs = await Promise.all(cards.map(k => bmp(k.img)))
  const cw = 300, ch = 420, gap = 30, cols = 3, left = (W - (cols * cw + (cols - 1) * gap)) / 2
  cards.forEach((k, i) => {
    const cx = left + (i % cols) * (cw + gap), cy = 230 + Math.floor(i / cols) * (ch + 90)
    x.fillStyle = '#060f2c'; x.fillRect(cx, cy, cw, ch)
    const b = imgs[i]
    if (b) {
      x.save(); x.beginPath(); x.rect(cx, cy, cw, ch); x.clip()
      if (b.width > b.height * 1.05) { x.translate(cx + cw / 2, cy + ch / 2); x.rotate(Math.PI / 2); const f = Math.min(ch / b.width, cw / b.height); x.drawImage(b, -b.width * f / 2, -b.height * f / 2, b.width * f, b.height * f) }
      else { const f = Math.min(cw / b.width, ch / b.height); x.drawImage(b, cx + (cw - b.width * f) / 2, cy + (ch - b.height * f) / 2, b.width * f, b.height * f) }
      x.restore()
    }
    x.lineWidth = 8; x.strokeStyle = RARITY_COLOR[k.rarity]; x.strokeRect(cx, cy, cw, ch)
    x.fillStyle = RARITY_COLOR[k.rarity]; x.fillRect(cx, cy + ch - 34, cw, 34); x.fillStyle = '#07143a'; x.font = '800 20px system-ui, sans-serif'; x.fillText(RARITY_NAME[k.rarity].toUpperCase(), cx + cw / 2, cy + ch - 11)
    x.fillStyle = '#fff'; x.font = '700 26px system-ui, sans-serif'; x.fillText(k.player.slice(0, 22), cx + cw / 2, cy + ch + 40, cw)
  })
  x.fillStyle = '#fdb927'; x.font = `400 52px ${DISPLAY}`; x.fillText('MEMORABILIUS.FR · UN PACK GRATUIT PAR HEURE', W / 2, H - 50, W - 60)
  return await new Promise(res => c.toBlob(b => res(b), 'image/png'))
}
