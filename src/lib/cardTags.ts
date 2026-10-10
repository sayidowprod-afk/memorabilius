// Helpers purs pour les etiquettes de cartes (RC / AUTO / PATCH / NUM) : couleurs, tirage, rarete.

export type TagKind = 'rc' | 'auto' | 'patch' | 'num'
export type NumTier = 'std' | 'gold' | 'silver' | 'bronze'

// Couleurs historiques des pastilles (chaque categorie a sa couleur fixe)
export const TAG_BASE: Record<TagKind, string> = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' }
export const TAG_LABEL: Record<Exclude<TagKind, 'num'>, string> = { rc: 'RC', auto: 'AUTO', patch: 'PATCH' }

// "038/125" -> 125 ; "/125" -> 125 ; "1/1" -> 1 ; sinon null
export function printRunOf(num?: string | null): number | null {
  if (!num) return null
  const m = num.trim().match(/\/\s*(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

// Numerotations speciales sans tirage chiffre : "SP" (short print) et "SSP" (super short print)
export function specialNum(num?: string | null): 'SP' | 'SSP' | null {
  if (!num) return null
  const t = num.toUpperCase()
  if (/\bSSP\b/.test(t)) return 'SSP'
  if (/\bSP\b/.test(t)) return 'SP'
  return null
}

// Rarete du tirage : 1/1 -> or ; 2-10 -> argent ; 11-25 -> bronze ; sans tirage : SSP -> or, SP -> argent
export function numTier(num?: string | null): NumTier {
  const v = printRunOf(num)
  if (v === 1) return 'gold'
  if (v !== null && v >= 2 && v <= 10) return 'silver'
  if (v !== null && v >= 11 && v <= 25) return 'bronze'
  if (v === null) {
    const sp = specialNum(num)
    if (sp === 'SSP') return 'gold'
    if (sp === 'SP') return 'silver'
  }
  return 'std'
}

// Texte court affiche : "/125" (ou "1/1", "SP", "SSP"). Le numero complet s'affiche au survol.
export function numShort(num?: string | null): string {
  const v = printRunOf(num)
  if (v === null) return specialNum(num) ?? ''
  return v === 1 ? '1/1' : `/${v}`
}

// melange d'une couleur hex avec du blanc (t>0) ou du noir (t<0)
export function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Effets des tirages bas (identiques aux pastilles historiques). Les animations viennent de globals.css.
export const RARE_FX: Record<Exclude<NumTier, 'std'>, { bg: string; fg: string; shadow: string; anim: string }> = {
  gold: { bg: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', fg: '#3d2800', shadow: '0 1px 0 rgba(255,255,255,0.45)', anim: 'oon-anim 1.8s ease-in-out infinite' },
  silver: { bg: 'linear-gradient(135deg,#555,#c0c0c0,#ffffff,#c0c0c0,#555)', fg: '#111', shadow: 'none', anim: 'low-anim 2.2s ease-in-out infinite' },
  bronze: { bg: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', fg: '#fff', shadow: '0 1px 2px rgba(0,0,0,0.6)', anim: 'bro-anim 2.6s ease-in-out infinite' },
}
