'use client'
import { useId } from 'react'
import { TAG_GLYPHS } from '@/lib/tagGlyphs'
import { numLabel, printRunOf } from '@/components/TagIcon'

// Icones RC / AUTO / PATCH / NUM en vectoriel (SVG), avec systeme de rarete :
// la teinte monte avec la valeur de la carte (voir cardTier). Les decoupes
// (lettres, ballon...) restent transparentes : ton sur ton, sans fond ajoute.

export type TagTier = 'base' | 'blue' | 'bronze' | 'silver' | 'gold'
type Kind = 'rc' | 'auto' | 'patch' | 'num'

// Rarete de la carte, deduite de ses attributs :
//  1/1 -> or ; 2-10 -> argent ; 11-25 -> bronze ; auto/patch/numerote -> bleu ; sinon base.
export function cardTier(c: { rc?: boolean; auto?: boolean; patch?: boolean; num?: string | null }): TagTier {
  const pr = printRunOf(c.num)
  if (pr === 1) return 'gold'
  if (pr !== null && pr <= 10) return 'silver'
  if (pr !== null && pr <= 25) return 'bronze'
  if (c.auto || c.patch || pr !== null) return 'blue'
  return 'base'
}

const STOPS: Record<Exclude<TagTier, 'base'>, [string, string, string]> = {
  blue: ['#8fb4ff', '#2f6bff', '#1a43b8'],
  bronze: ['#f0b982', '#b36b30', '#6f3f17'],
  silver: ['#fbfcfe', '#b4bcc8', '#6c7585'],
  gold: ['#fff2b8', '#e3b53b', '#8f6208'],
}
const TEXT_ON: Record<TagTier, string> = { base: '#fff', blue: '#fff', bronze: '#fff', silver: '#10151d', gold: '#2a1a00' }
const LABEL: Record<Kind, string> = { rc: 'Rookie Card', auto: 'Autographe', patch: 'Patch', num: 'Numérotée' }
// hauteur visuelle relative (l'icone AUTO est tres allongee)
const SCALE: Record<Kind, number> = { rc: 1, auto: 0.78, patch: 0.9, num: 1.05 }

export default function TagGlyph({ kind, h = 28, tier = 'base', ink = '#ffffff', num, shine = true }: {
  kind: Kind
  h?: number
  tier?: TagTier
  ink?: string         // couleur de la version "base" (monochrome) : blanc sur sombre, navy sur clair
  num?: string | null
  shine?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const g = TAG_GLYPHS[kind]
  const height = h * SCALE[kind]
  const width = (height * g.w) / g.h
  const fill = tier === 'base' ? ink : `url(#f${uid})`
  const label = kind === 'num' ? numLabel(num) : ''
  const stops = tier === 'base' ? null : STOPS[tier]
  return (
    <svg role="img" aria-label={LABEL[kind]} viewBox={`0 0 ${g.w} ${g.h}`} width={width} height={height}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', overflow: 'visible',
        filter: tier === 'gold' ? 'drop-shadow(0 0 3px rgba(227,181,59,0.55))' : undefined }}>
      <title>{LABEL[kind]}</title>
      <defs>
        {stops && (
          <linearGradient id={`f${uid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={stops[0]} /><stop offset="0.5" stopColor={stops[1]} /><stop offset="1" stopColor={stops[2]} />
          </linearGradient>
        )}
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0.6" y2="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={g.d} fill={fill} fillRule="evenodd" />
      {shine && tier !== 'base' && <path d={g.d} fill={`url(#s${uid})`} fillRule="evenodd" />}
      {label && (
        <text x={g.w / 2} y={g.h * 0.585} textAnchor="middle" dominantBaseline="middle"
          fontFamily="system-ui, sans-serif" fontWeight={900} fontSize={g.h * (label.length > 4 ? 0.3 : 0.36)}
          fill={tier === 'base' ? (ink === '#ffffff' ? '#050912' : '#ffffff') : TEXT_ON[tier]}
          stroke={tier === 'base' ? ink : STOPS[tier][1]} strokeWidth={g.h * 0.075} paintOrder="stroke" strokeLinejoin="round" letterSpacing="-0.02em">
          {label}
        </text>
      )}
    </svg>
  )
}
