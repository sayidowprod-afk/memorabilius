import { TAG_BASE, numShort, numTier, mix, rgba, type TagKind } from '@/lib/cardTags'

// Dessin canvas des etiquettes "teintees" (RC / AUTO / tirage / PATCH) pour les exports photo et video.
// Meme style que le site : fond de la couleur a faible opacite, bordure et texte de la couleur,
// coins arrondis ; effet or / argent / bronze sur les tirages bas ; tout tient sur une ligne.

export type TagDrawItem = { kind: TagKind | 'extra'; text: string; num?: string; color?: string }

export function cardTagDrawItems(card: { rc?: boolean; auto?: boolean; patch?: boolean; num?: string | null; g?: string }, extraColor?: string): TagDrawItem[] {
  const items: TagDrawItem[] = []
  if (card.rc) items.push({ kind: 'rc', text: 'RC' })
  if (card.auto) items.push({ kind: 'auto', text: 'AUTO' })
  if (card.num) items.push({ kind: 'num', text: numShort(card.num) || 'NUM', num: card.num })
  if (card.patch) items.push({ kind: 'patch', text: 'PATCH' })
  if (extraColor && card.g && card.g !== 'Raw') items.push({ kind: 'extra', text: card.g, color: extraColor })
  return items
}

const RARE = {
  gold: { stops: ['#b8860b', '#ffd700', '#fffacd', '#ffd700', '#b8860b'], fg: '#3d2800' },
  silver: { stops: ['#555555', '#c0c0c0', '#ffffff', '#c0c0c0', '#555555'], fg: '#111111' },
  bronze: { stops: ['#6d3a00', '#cd7f32', '#f5cba7', '#cd7f32', '#6d3a00'], fg: '#ffffff' },
} as const

// Dessine la rangee, centree sur `cx`. Retourne la hauteur utilisee. `maxW` : largeur disponible (reduit la taille si besoin).
export function drawTagRow(ctx: CanvasRenderingContext2D, items: TagDrawItem[], o: {
  cx: number; y: number; maxW: number; h: number; gap: number; isDark: boolean; fontFamily: string
}): number {
  if (!items.length) return 0
  let h = o.h
  const widthAt = (ph: number) => {
    ctx.font = `900 ${Math.max(7, Math.round(ph * 0.5))}px ${o.fontFamily}`
    return items.reduce((a, it) => a + ctx.measureText(it.text).width + ph * 0.9, 0) + o.gap * (items.length - 1)
  }
  const total = widthAt(h)
  if (total > o.maxW) h = Math.max(10, Math.floor(h * (o.maxW / total)))
  const gap = o.gap * (h / o.h)
  const totalW = widthAt(h) - o.gap * (items.length - 1) + gap * (items.length - 1)
  const fs = Math.max(7, Math.round(h * 0.5))
  ctx.font = `900 ${fs}px ${o.fontFamily}`
  const prevAlign = ctx.textAlign
  const prevBase = ctx.textBaseline
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let x = o.cx - totalW / 2
  const r = Math.round(h * 0.28)
  for (const it of items) {
    const w = Math.round(ctx.measureText(it.text).width + h * 0.9)
    const tier = it.kind === 'num' ? numTier(it.num) : 'std'
    if (tier !== 'std') {
      const fx = RARE[tier]
      const g = ctx.createLinearGradient(x, o.y, x + w, o.y + h)
      fx.stops.forEach((c, i) => g.addColorStop(i / (fx.stops.length - 1), c))
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x, o.y, w, h, r); ctx.fill()
      ctx.fillStyle = fx.fg
    } else {
      const c = it.kind === 'extra' ? (it.color || '#003DA6') : TAG_BASE[it.kind]
      ctx.fillStyle = rgba(c, o.isDark ? 0.32 : 0.18)
      ctx.beginPath(); ctx.roundRect(x, o.y, w, h, r); ctx.fill()
      ctx.strokeStyle = rgba(c, 0.85); ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(x + 0.5, o.y + 0.5, w - 1, h - 1, r); ctx.stroke()
      ctx.fillStyle = o.isDark ? mix(c, 0.7) : mix(c, -0.3)
    }
    ctx.fillText(it.text, x + w / 2, o.y + h / 2 + 0.5)
    x += w + gap
  }
  ctx.textAlign = prevAlign
  ctx.textBaseline = prevBase
  return h
}
