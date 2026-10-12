'use client'
import { numShort, numTier, TAG_BASE } from '@/lib/cardTags'

// Barre d'atouts defilante des vignettes (galerie, pepites de l'accueil...) : une seule definition, pour que le rendu reste identique partout.
// Ordre fixe RC / Auto / Patch / Num. Le fond defile avec les mots : chaque atout a SA couleur derriere lui, fondu vers celle de ses voisins ;
// texte fonce sur les couleurs claires (or, argent). Rien n'est rendu sans atout (l'appelant reserve la hauteur avec .gc-slot).
type At = { k: string; t: string; c: string }

const lumOf = (h: string) => {
  const n = parseInt(h.replace('#', '').slice(0, 6), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

export default function AtoutsStrip({ rc, auto, patch, num, memo, plate }: {
  rc?: boolean; auto?: boolean; patch?: boolean; num?: string | null; memo?: boolean; plate?: boolean
}) {
  const ats: At[] = []
  if (memo) ats.push({ k: 'memo', t: 'Mémo', c: '#c77dff' })
  if (rc) ats.push({ k: 'rc', t: 'RC', c: TAG_BASE.rc })
  if (auto) ats.push({ k: 'auto', t: 'Auto', c: TAG_BASE.auto })
  if (patch) ats.push({ k: 'patch', t: 'Patch', c: TAG_BASE.patch })
  if (plate) ats.push({ k: 'plate', t: 'Plate', c: '#9aa6bd' })
  if (num) {
    const tr = numTier(num)
    ats.push({ k: 'num', t: numShort(num), c: tr === 'gold' ? '#ffd54a' : tr === 'silver' ? '#dfe6f2' : tr === 'bronze' ? '#e0925a' : TAG_BASE.num })
  }
  if (!ats.length) return null
  const reps = Math.max(4, Math.ceil(20 / ats.length))
  const seq = Array.from({ length: reps }, () => ats).flat()
  const unit = (key: string) => (
    <span key={key}>{seq.map((x, i) => {
      const pv = seq[(i - 1 + seq.length) % seq.length], nx = seq[(i + 1) % seq.length]
      return (
        <em key={i} className="gs-w" style={{ ['--a' as string]: x.c, ['--p' as string]: pv.c, ['--n' as string]: nx.c, ['--t' as string]: lumOf(x.c) > 0.7 ? '#1a1200' : '#fff' }}>
          {x.t}<i>✦</i>
        </em>
      )
    })}</span>
  )
  return (
    <div className="gs-strip" aria-label={ats.map(x => x.t).join(' ')}>
      <div className="gs-seg" style={{ ['--d' as string]: `${30 + ats.length * 4}s` }}>
        <div className="gs-mq">{unit('a')}{unit('b')}</div>
      </div>
    </div>
  )
}
