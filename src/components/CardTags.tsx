'use client'
import React from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { TAG_BASE, TAG_LABEL, mix, rgba, numShort, numTier, RARE_FX, type TagKind } from '@/lib/cardTags'

// Etiquettes "teintees" : fond de la couleur de la categorie, bordure et texte de la meme couleur,
// coins arrondis. Meme hauteur quel que soit le nombre d'etiquettes ; le texte s'adapte a la
// largeur disponible pour que TOUT tienne sur une ligne. Tirage affiche en court ("/125"),
// numero complet au survol ; effet or / argent / bronze sur les tirages bas.

type Dims = { base: number }
const SIZES = { xs: { base: 10 }, sm: { base: 11 }, md: { base: 12 }, lg: { base: 13.5 } } as const satisfies Record<string, Dims>
export type TagSize = keyof typeof SIZES

// largeur du pire cas, en em : RC + AUTO + PATCH + tirage a 4 chiffres, avec espacements
const WORST_CASE_EM = 16 * 0.86 + 4 * 1.5 + 4 * 0.35

function pillStyle(kind: TagKind, num: string | null | undefined, dark: boolean): { style: React.CSSProperties; text: string; title?: string } {
  const c = TAG_BASE[kind]
  const text = kind === 'num' ? (numShort(num) || 'NUM') : TAG_LABEL[kind]
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.75em', borderRadius: '0.42em', boxSizing: 'border-box' }
  const title = kind === 'num' && num ? `Numérotation : ${num}` : undefined
  if (kind === 'num') {
    const tier = numTier(num)
    if (tier !== 'std') {
      const fx = RARE_FX[tier]
      return { text, title, style: { ...base, background: fx.bg, color: fx.fg, textShadow: fx.shadow, animation: fx.anim, position: 'relative', zIndex: 1 } }
    }
  }
  return {
    text, title,
    style: { ...base, background: rgba(c, dark ? 0.32 : 0.18), color: dark ? mix(c, 0.7) : mix(c, -0.3), border: `1px solid ${rgba(c, 0.85)}` },
  }
}

const TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1,
  fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase', whiteSpace: 'nowrap',
}

// Une etiquette isolee (ex : a cote d'un nom dans une liste). `h` = hauteur voulue en px.
export function TagPill({ kind, num, h = 22, title }: { kind: TagKind; num?: string | null; h?: number; title?: string }) {
  const { dark } = useTheme()
  const p = pillStyle(kind, num, dark)
  return <span title={title || p.title} style={{ ...TEXT_STYLE, ...p.style, height: h, fontSize: h * 0.5, flexShrink: 0 }}>{p.text}</span>
}

// Le groupe d'etiquettes d'une carte, sur UNE ligne, toujours en entier.
export default function CardTags({ rc, auto, patch, num, numText, size = 'md' }: {
  rc?: boolean; auto?: boolean; patch?: boolean
  num?: boolean | string | null
  numText?: string | null
  size?: TagSize
}) {
  const { dark } = useTheme()
  const numValue = typeof num === 'string' ? num : numText
  const items: { kind: TagKind; num?: string | null }[] = []
  if (rc) items.push({ kind: 'rc' })
  if (auto) items.push({ kind: 'auto' })
  if (num) items.push({ kind: 'num', num: numValue })
  if (patch) items.push({ kind: 'patch' })
  if (!items.length) return null
  const base = SIZES[size].base
  return (
    <span style={{ display: 'block', containerType: 'inline-size', width: '100%' }}>
      <span style={{ ...TEXT_STYLE, display: 'inline-flex', alignItems: 'stretch', gap: '0.32em', height: '2.3em', maxWidth: '100%',
        fontSize: `clamp(8px, calc(100cqw / ${WORST_CASE_EM.toFixed(2)}), ${base}px)` }}>
        {items.map(it => {
          const p = pillStyle(it.kind, it.num, dark)
          return <span key={it.kind} title={p.title} style={p.style}>{p.text}</span>
        })}
      </span>
    </span>
  )
}
