import { TAG_BASE, numShort, numTier } from '@/lib/cardTags'

// ── Bandeau d'atouts (DA) ────────────────────────────────────────────────────
// Meme bandeau continu que AtoutsStrip.tsx (galerie, pepites...) -- chaque
// atout a SA couleur, fondue vers celle de son voisin, separes par une
// etoile, au lieu des pastilles isolees de l'ancienne DA. Version statique
// (un seul passage, pas de defilement) pour les exports photo/video.
export type AtoutItem = { text: string; color: string }

const lumOf = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
// Equivalent de CSS color-mix(in srgb, a, b) a 50/50 -- simple interpolation lineaire RGB.
function blend(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16)
  const ch = [0, 1, 2].map(i => {
    const av = (a >> (16 - i * 8)) & 255, bv = (b >> (16 - i * 8)) & 255
    return Math.round(av + (bv - av) * t)
  })
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

// Memes regles de couleur que AtoutsStrip.tsx : ordre fixe RC / Auto / Patch / Num(+tirage),
// plus la pastille "grade" (PSA 10, Raw...) propre aux exports (pas sur le site).
export function atoutsItems(card: { rc?: boolean; auto?: boolean; patch?: boolean; num?: string | null; g?: string }, extraColor?: string): AtoutItem[] {
  const items: AtoutItem[] = []
  if (card.rc) items.push({ text: 'RC', color: TAG_BASE.rc })
  if (card.auto) items.push({ text: 'AUTO', color: TAG_BASE.auto })
  if (card.patch) items.push({ text: 'PATCH', color: TAG_BASE.patch })
  if (card.num) {
    const tr = numTier(card.num)
    const c = tr === 'gold' ? '#ffd54a' : tr === 'silver' ? '#dfe6f2' : tr === 'bronze' ? '#e0925a' : TAG_BASE.num
    items.push({ text: numShort(card.num) || 'NUM', color: c })
  }
  if (extraColor && card.g && card.g !== 'Raw') items.push({ text: card.g, color: extraColor })
  return items
}

// Dessine le bandeau sur toute `width` (comme le bandeau du site, qui est
// toujours plein cadre -- inset:0) : la sequence d'atouts est repetee autant
// de fois que necessaire pour couvrir toute la largeur, comme la boucle
// continue de AtoutsStrip.tsx, mais figee a un seul passage (pas de
// defilement). Les segments sont STRICTEMENT contigus (pas d'ecart reserve
// pour l'etoile) : l'etoile est juste dessinee PAR-DESSUS chaque jointure,
// exactement comme `.gs-w i` en CSS (position absolue a cheval sur le bord).
export function drawAtoutsBand(ctx: CanvasRenderingContext2D, items: AtoutItem[], o: {
  cx: number; y: number; width: number; h: number; fontFamily: string
}): number {
  if (!items.length) return 0
  const h = o.h
  const fs = Math.max(7, Math.round(h * 0.46))
  ctx.font = `900 ${fs}px ${o.fontFamily}`
  const prevAlign = ctx.textAlign
  const prevBase = ctx.textBaseline
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const pad = h * 0.9
  const segWOf = (it: AtoutItem) => Math.round(ctx.measureText(it.text).width + pad * 2)

  // Repete la sequence jusqu'a couvrir toute la largeur disponible.
  const seq: AtoutItem[] = []
  const segW: number[] = []
  let total = 0
  while (total < o.width) {
    for (const it of items) {
      const w = segWOf(it)
      seq.push(it); segW.push(w); total += w
      if (total >= o.width) break
    }
  }

  const left = o.cx - o.width / 2
  ctx.save()
  ctx.beginPath(); ctx.rect(left, o.y, o.width, h); ctx.clip()

  let x = left
  for (let i = 0; i < seq.length; i++) {
    const it = seq[i]
    const w = segW[i]
    const prevColor = i > 0 ? seq[i - 1].color : it.color
    const nextColor = i < seq.length - 1 ? seq[i + 1].color : it.color
    const grad = ctx.createLinearGradient(x, 0, x + w, 0)
    grad.addColorStop(0, blend(prevColor, it.color, 0.5))
    grad.addColorStop(0.3, it.color)
    grad.addColorStop(0.7, it.color)
    grad.addColorStop(1, blend(it.color, nextColor, 0.5))
    ctx.fillStyle = grad
    ctx.fillRect(x, o.y, w, h)
    ctx.fillStyle = lumOf(it.color) > 0.7 ? '#1a1200' : '#fff'
    ctx.fillText(it.text, x + w / 2, o.y + h / 2 + 0.5)
    x += w
  }

  // Etoiles de separation, dessinees apres coup sur chaque jointure interne --
  // jamais de reserve d'espace dediee, donc jamais de trou dans le fond.
  ctx.font = `400 ${Math.round(h * 0.4)}px ${o.fontFamily}`
  ctx.fillStyle = '#fff'
  let bx = left
  for (let i = 0; i < seq.length - 1; i++) {
    bx += segW[i]
    ctx.fillText('✦', bx, o.y + h / 2 + 0.5)
  }

  ctx.restore()
  ctx.textAlign = prevAlign
  ctx.textBaseline = prevBase
  return h
}
