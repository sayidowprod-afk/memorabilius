'use client'

// Icones RC / AUTO / PATCH / NUM (nouvelle DA). Les images sont pre-colorees et
// rognees dans /public/tags/dist (voir le dossier d'origine /public/tags). Le
// tirage s'ecrit PAR-DESSUS l'icone NUM, avec un contour pour rester lisible.

export type TagKind = 'rc' | 'auto' | 'patch' | 'num'
export type NumTier = 'std' | 'gold' | 'silver' | 'bronze'

// largeur / hauteur de chaque image rognee
const RATIO: Record<TagKind, number> = { rc: 211 / 256, auto: 256 / 99, patch: 1, num: 256 / 209 }
// hauteur visuelle relative a la hauteur demandee (l'icone AUTO est tres allongee)
const SCALE: Record<TagKind, number> = { rc: 1, auto: 0.8, patch: 0.92, num: 1.08 }
const SRC: Record<TagKind, string> = {
  rc: '/tags/dist/rc.png', auto: '/tags/dist/auto.png', patch: '/tags/dist/patch.png', num: '/tags/dist/num.png',
}
const NUM_SRC: Record<NumTier, string> = {
  std: '/tags/dist/num.png', gold: '/tags/dist/num-gold.png', silver: '/tags/dist/num-silver.png', bronze: '/tags/dist/num-bronze.png',
}
const STROKE: Record<NumTier, string> = { std: '#1a0033', gold: '#3d2800', silver: '#1c2128', bronze: '#2b1500' }
const LABEL: Record<TagKind, string> = { rc: 'Rookie Card', auto: 'Autographe', patch: 'Patch', num: 'Numérotée' }

// "038/149" -> 149 ; "/149" -> 149 ; "1/1" -> 1 ; sinon null
export function printRunOf(num?: string | null): number | null {
  if (!num) return null
  const m = num.trim().match(/\/\s*(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

export function numTier(num?: string | null): NumTier {
  const v = printRunOf(num)
  if (v === 1) return 'gold'
  if (v !== null && v >= 2 && v <= 10) return 'silver'
  if (v !== null && v >= 11 && v <= 25) return 'bronze'
  return 'std'
}

// Texte affiche sur l'icone NUM : "/149" (ou "1/1"). Sans tirage lisible : vide.
export function numLabel(num?: string | null): string {
  const v = printRunOf(num)
  if (v === null) return ''
  return v === 1 ? '1/1' : `/${v}`
}

export default function TagIcon({ kind, h = 28, num, tier, title }: {
  kind: TagKind
  h?: number            // hauteur de reference en px
  num?: string | null   // seulement pour kind="num"
  tier?: NumTier        // force le style (sinon deduit du tirage)
  title?: string
}) {
  const height = Math.round(h * SCALE[kind] * 10) / 10
  const width = Math.round(height * RATIO[kind] * 10) / 10
  const tr = kind === 'num' ? (tier || numTier(num)) : 'std'
  const text = kind === 'num' ? numLabel(num) : ''
  const src = kind === 'num' ? NUM_SRC[tr] : SRC[kind]
  const fs = text.length > 4 ? height * 0.27 : height * 0.33
  return (
    <span title={title || LABEL[kind]} style={{ position: 'relative', display: 'inline-block', width, height, flexShrink: 0, lineHeight: 0, verticalAlign: 'middle' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={LABEL[kind]} width={width} height={height} draggable={false}
        style={{ width, height, display: 'block', background: 'none', animation: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.28))', pointerEvents: 'none' }} />
      {text && (
        <b style={{
          position: 'absolute', left: '50%', top: '55%', transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap',
          fontFamily: 'system-ui, sans-serif', fontWeight: 900, fontSize: fs, lineHeight: 1, color: '#fff',
          WebkitTextStroke: `${Math.max(1, height * 0.085)}px ${STROKE[tr]}`, paintOrder: 'stroke fill', letterSpacing: '-0.02em',
        }}>{text}</b>
      )}
    </span>
  )
}
