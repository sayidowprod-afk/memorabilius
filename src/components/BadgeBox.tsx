'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES, BadgeCategory, BadgeTier } from '@/lib/badgeDefinitions'
import { toast } from '@/lib/toast'
import { hapticSuccess } from '@/lib/haptics'
import { maybePromptReview } from '@/lib/reviewPrompt'

// ── SVG path generators (module-level, computed once) ──────────────────────
function polyPath(n: number, r: number, cx = 50, cy = 50, off = 0) {
  return 'M' + Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2 + off
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join('L') + 'Z'
}
function starPath(n: number, r1: number, r2: number, cx = 50, cy = 50) {
  return 'M' + Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? r1 : r2
    const a = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join('L') + 'Z'
}
function scallop(n: number, r1: number, r2: number, cx = 50, cy = 50) {
  return 'M' + Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? r1 : r2
    const a = (i / (n * 2)) * 2 * Math.PI - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join('L') + 'Z'
}

// ── Shapes: outer silhouette + inner rim + field area ─────────────────────
type Shape = { outer: string; inner: string; field: string }
function circleField(r: number, cx = 50, cy = 50) {
  return `M${cx + r},${cy}A${r},${r},0,1,0,${cx - r},${cy}A${r},${r},0,1,0,${cx + r},${cy}Z`
}
const CAT_SHAPE: Record<string, Shape> = {
  cartes: {
    outer: scallop(14, 44, 39),
    inner: scallop(14, 34, 29),
    field: circleField(24),
  },
  rc: {
    outer: starPath(5, 44, 17),
    inner: starPath(5, 36, 13),
    field: circleField(10),
  },
  patch: {
    outer: starPath(4, 44, 26),
    inner: starPath(4, 36, 19),
    field: starPath(4, 27, 12),
  },
  num: {
    outer: scallop(6, 44, 40),
    inner: polyPath(6, 33),
    field: circleField(22),
  },
  mois: {
    outer: 'M50,4Q87,15 89,46Q89,79 50,95Q11,79 11,46Q13,15 50,4Z',
    inner: 'M50,13Q79,23 81,47Q81,73 50,87Q19,73 19,47Q21,23 50,13Z',
    field: 'M50,22Q72,30 74,49Q74,68 50,79Q26,68 26,49Q28,30 50,22Z',
  },
  views: {
    outer: 'M4,50Q20,11 50,9Q80,11 96,50Q80,89 50,91Q20,89 4,50Z',
    inner: 'M10,50Q24,19 50,17Q76,19 90,50Q76,81 50,83Q24,81 10,50Z',
    field: circleField(19),
  },
  teams: {
    outer: polyPath(6, 44, 50, 50, Math.PI / 6),
    inner: polyPath(6, 35, 50, 50, Math.PI / 6),
    field: circleField(25),
  },
}

// ── Tier colour system ────────────────────────────────────────────────────
const TIER_NAMES = ['Bois', 'Pierre', 'Fer', 'Bronze', 'Argent', 'Or', 'Saphir', 'Diamant']
const TIER = [
  { from: '#4a2e10', mid: '#8a5220', hi: '#c8803c', bottom: '#2a1808', glow: '#9a6028', border: '#c0783888', rl: '#d89040', rd: '#3a2010' },
  { from: '#383838', mid: '#787878', hi: '#c0c0c0', bottom: '#181818', glow: '#909090', border: '#aaaaaa88', rl: '#e0e0e0', rd: '#282828' },
  { from: '#1e3048', mid: '#3870b0', hi: '#78b0d8', bottom: '#101828', glow: '#6080a8', border: '#70a0c888', rl: '#90c0e0', rd: '#182030' },
  { from: '#804010', mid: '#c88020', hi: '#f8c030', bottom: '#502808', glow: '#d49020', border: '#f8c84088', rl: '#ffd040', rd: '#604010' },
  { from: '#404040', mid: '#a8a8a8', hi: '#f0f0f0', bottom: '#202020', glow: '#c8c8c8', border: '#e8e8e888', rl: '#ffffff', rd: '#303030' },
  { from: '#705800', mid: '#c89000', hi: '#ffe828', bottom: '#403000', glow: '#e8c000', border: '#f8e01888', rl: '#fff060', rd: '#584000' },
  { from: '#003870', mid: '#0870c8', hi: '#58c8ff', bottom: '#001840', glow: '#30a8f8', border: '#50c0f888', rl: '#90e0ff', rd: '#002050' },
  { from: '#380068', mid: '#9020d0', hi: '#f040ff', bottom: '#180038', glow: '#d838f8', border: '#e838f888', rl: '#ff70ff', rd: '#300050', holo: true },
] as const
type Pal = typeof TIER[number]

function tierColorIdx(i: number, total: number) {
  if (total <= 1) return TIER.length - 1
  return Math.round((i / (total - 1)) * (TIER.length - 1))
}
function fmtN(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n) }

// ── Data types ───────────────────────────────────────────────────────────
type BadgeData = {
  earned_badges: string[]
  stat_total: number; stat_rc: number; stat_patch: number; stat_num: number
  mois_count: number; views_count: number; teams_count: number
}
type TooltipInfo = {
  x: number; y: number; above: boolean
  cat: BadgeCategory; tier: BadgeTier
  palIdx: number; isEarned: boolean; statVal: number
}

// ── SVG Badge ────────────────────────────────────────────────────────────
function BadgeSVG({ cat, tier, palIdx, isEarned, size = 64 }: {
  cat: BadgeCategory; tier: BadgeTier; palIdx: number; isEarned: boolean; size?: number
}) {
  const pal = TIER[palIdx] as Pal
  const sh = CAT_SHAPE[cat.id] ?? CAT_SHAPE.cartes
  const gid = `${cat.id}-${tier.id}`

  // Per-category decorative elements
  const deco = (() => {
    if (!isEarned) return null
    switch (cat.id) {
      case 'cartes':
        return Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * 2 * Math.PI - Math.PI / 2
          return <circle key={i} cx={(50 + 36.5 * Math.cos(a)).toFixed(1)} cy={(50 + 36.5 * Math.sin(a)).toFixed(1)} r="2" fill="rgba(255,255,255,0.22)" />
        })
      case 'rc':
        return Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * 2 * Math.PI - Math.PI / 2
          return <line key={i} x1="50" y1="50" x2={(50 + 33 * Math.cos(a)).toFixed(1)} y2={(50 + 33 * Math.sin(a)).toFixed(1)} stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        })
      case 'num':
        return Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * 2 * Math.PI - Math.PI / 2
          return <line key={i} x1={(50 + 8 * Math.cos(a)).toFixed(1)} y1={(50 + 8 * Math.sin(a)).toFixed(1)} x2={(50 + 28 * Math.cos(a)).toFixed(1)} y2={(50 + 28 * Math.sin(a)).toFixed(1)} stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        })
      case 'mois':
        return <line x1="20" y1="37" x2="80" y2="37" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
      case 'views':
        return <>
          <circle cx="50" cy="50" r="12" fill={pal.from} opacity="0.85" />
          <circle cx="50" cy="50" r="5.5" fill={pal.hi} opacity="0.9" />
          <circle cx="54" cy="46" r="2.8" fill="rgba(255,255,255,0.65)" />
        </>
      case 'patch':
        return <>
          <line x1="36" y1="36" x2="64" y2="64" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <line x1="64" y1="36" x2="36" y2="64" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <line x1="50" y1="30" x2="50" y2="70" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="30" y1="50" x2="70" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </>
      case 'teams':
        return <>
          <circle cx="50" cy="42" r="7" fill="rgba(255,255,255,0.15)" />
          <path d="M34,64Q34,54 50,54Q66,54 66,64Z" fill="rgba(255,255,255,0.12)" />
        </>
    }
    return null
  })()

  // Universal sunburst
  const rays = isEarned ? Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 2 * Math.PI
    return <line key={i} x1="50" y1="50" x2={(50 + 26 * Math.cos(a)).toFixed(1)} y2={(50 + 26 * Math.sin(a)).toFixed(1)} stroke="rgba(255,255,255,0.065)" strokeWidth="1" />
  }) : null

  const emojiSize = cat.id === 'rc' ? 22 : cat.id === 'patch' ? 22 : 27

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        {/* Metallic face gradient */}
        <linearGradient id={`f-${gid}`} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor={pal.from} />
          <stop offset="30%" stopColor={pal.mid} />
          <stop offset="52%" stopColor={pal.hi} />
          <stop offset="78%" stopColor={pal.mid} />
          <stop offset="100%" stopColor={pal.from} />
        </linearGradient>
        {/* Rim gradient */}
        <linearGradient id={`r-${gid}`} x1="0%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor={(pal as {rl:string}).rl} />
          <stop offset="55%" stopColor={pal.mid} />
          <stop offset="100%" stopColor={(pal as {rd:string}).rd} />
        </linearGradient>
        {/* Radial shine overlay */}
        <radialGradient id={`s-${gid}`} cx="36%" cy="26%" r="56%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.52)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Bottom shadow gradient */}
        <linearGradient id={`b-${gid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={pal.bottom} stopOpacity="0.5" />
          <stop offset="100%" stopColor={pal.bottom} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {isEarned ? (<>
        {/* 3D depth layer */}
        <g transform="translate(0,7)" opacity="0.7">
          <path d={sh.outer} fill={`url(#b-${gid})`} />
        </g>

        {/* Outer rim */}
        <path d={sh.outer} fill={`url(#r-${gid})`} />

        {/* Outer rim bevel highlight */}
        <path d={sh.outer} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

        {/* Main field fill */}
        <path d={sh.inner} fill={`url(#f-${gid})`} />

        {/* Sunburst rays */}
        {rays}

        {/* Field circle */}
        <path d={sh.field} fill={pal.from} opacity="0.45" />

        {/* Category decoration */}
        {deco}

        {/* Holo shimmer for Diamant */}
        {(pal as { holo?: boolean }).holo && (
          <path d={sh.inner} fill="none" stroke={pal.hi} strokeWidth="1"
            style={{ animation: 'holo-badge 2.5s ease infinite' }} opacity="0.35" />
        )}

        {/* Inner rim border */}
        <path d={sh.inner} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.8" />

        {/* Shine overlay */}
        <path d={sh.inner} fill={`url(#s-${gid})`} />

        {/* Emoji centred */}
        <text
          x="50" y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={String(emojiSize)}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.75))' }}
        >{cat.emoji}</text>

      </>) : (<>
        {/* Locked — dim silhouette */}
        <path d={sh.outer} fill="#1a0830" opacity="0.38" />
        <path d={sh.inner} fill="#0d0420" opacity="0.5" />
        <path d={sh.inner} fill="none" stroke="rgba(120,60,160,0.2)" strokeWidth="1" />
        <text x="50" y="52" textAnchor="middle" dominantBaseline="middle"
          fontSize="20" opacity="0.28">🔒</text>
      </>)}
    </svg>
  )
}

// ── Tooltip portal ────────────────────────────────────────────────────────
function BadgeTooltip({ t }: { t: TooltipInfo }) {
  const pal = TIER[t.palIdx] as Pal
  const pct = Math.min(t.statVal / t.tier.threshold, 1)
  const yPos = t.above ? t.y - 14 : t.y + 70

  return (
    <div style={{
      position: 'fixed', left: t.x, top: yPos,
      transform: t.above ? 'translate(-50%,-100%)' : 'translate(-50%,0)',
      zIndex: 99999, pointerEvents: 'none',
      background: 'linear-gradient(145deg,#0d1b2e,#162438)',
      border: `1px solid ${pal.border}`,
      borderRadius: 12, padding: '10px 14px', minWidth: 210,
      boxShadow: `0 8px 32px rgba(0,0,0,.85), 0 0 24px ${pal.glow}44, inset 0 1px 0 rgba(255,255,255,.05)`,
      animation: 'tooltip-in .15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          flexShrink: 0,
          filter: t.isEarned ? `drop-shadow(0 0 8px ${pal.glow})` : 'none',
        }}>
          <BadgeSVG cat={t.cat} tier={t.tier} palIdx={t.palIdx} isEarned={t.isEarned} size={40} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>{t.cat.emoji} {t.cat.label}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.isEarned ? pal.glow : '#94a3b8', lineHeight: 1.3 }}>
            {t.isEarned ? '✓ ' : '🔒 '}{TIER_NAMES[t.palIdx]}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, marginBottom: t.isEarned ? 0 : 8 }}>
        {t.tier.label} {t.cat.unit}
      </div>
      {!t.isEarned && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 4 }}>
          <span>Progression</span>
          <span>{fmtN(t.statVal)} / {fmtN(t.tier.threshold)}</span>
        </div>
        <div style={{ height: 4, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg,${pal.glow},${pal.border})`, borderRadius: 2, transition: '.3s' }} />
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 5, textAlign: 'right' }}>
          {Math.round(pct * 100)}%
        </div>
      </>)}
    </div>
  )
}

// ── Badge3D — hover wrapper ───────────────────────────────────────────────
function Badge3D({ cat, tier, tierIdx, totalTiers, isEarned, statVal, setTooltip }: {
  cat: BadgeCategory; tier: BadgeTier; tierIdx: number; totalTiers: number
  isEarned: boolean; statVal: number
  setTooltip: (t: TooltipInfo | null) => void
}) {
  const palIdx = tierColorIdx(tierIdx, totalTiers)
  const pal = TIER[palIdx] as Pal

  const defaultFilter = isEarned
    ? `drop-shadow(0 0 10px ${pal.glow}) drop-shadow(0 4px 8px rgba(0,0,0,.65))`
    : 'none'

  const showTooltip = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      above: rect.top > 200,
      cat, tier, palIdx, isEarned, statVal,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div
        style={{
          width: 64, height: 64, position: 'relative', flexShrink: 0,
          transition: 'transform .3s cubic-bezier(.17,.67,.32,1.4), filter .28s ease',
          filter: defaultFilter, cursor: 'default',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          if (isEarned) {
            el.style.transform = 'translateY(-16px) scale(1.2) rotateY(20deg)'
            el.style.filter = `drop-shadow(0 0 24px ${pal.glow}) drop-shadow(0 0 52px ${pal.glow}66) drop-shadow(0 18px 12px rgba(0,0,0,.8))`
          } else {
            el.style.transform = 'translateY(-4px) scale(1.06)'
            el.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,.65))'
          }
          showTooltip(e)
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = ''
          el.style.filter = defaultFilter
          setTooltip(null)
        }}
      >
        <BadgeSVG cat={cat} tier={tier} palIdx={palIdx} isEarned={isEarned} size={64} />
      </div>

      <div style={{
        fontSize: 8, fontWeight: 800,
        color: isEarned ? pal.rl : 'rgba(255,255,255,.75)',
        textShadow: isEarned ? `0 0 6px ${pal.glow}, 0 1px 2px rgba(0,0,0,.9)` : '0 1px 2px rgba(0,0,0,.9)',
        letterSpacing: '.04em', lineHeight: 1,
        background: 'rgba(0,0,0,.4)', padding: '2px 5px', borderRadius: 5,
      }}>{tier.label}</div>
    </div>
  )
}

// ── Confetti de célébration (nouveau badge débloqué) ────────────────────────
const CONFETTI_COLORS = ['#f0cc70', '#9a6028', '#78b0d8', '#f8c030', '#d838f8', '#58c8ff']

function ConfettiBurst({ label, emoji }: { label: string; emoji: string }) {
  const particles = Array.from({ length: 26 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    duration: 1.1 + Math.random() * 0.6,
    rotate: Math.random() * 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
  }))

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(60vh) rotate(540deg); opacity: 0; }
        }
        @keyframes badge-toast-in {
          0%   { transform: translate(-50%, -20px); opacity: 0; }
          15%  { transform: translate(-50%, 0); opacity: 1; }
          85%  { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -12px); opacity: 0; }
        }
      `}</style>
      {particles.map(p => (
        <span key={p.id} style={{
          position: 'absolute', top: 0, left: `${p.left}%`,
          width: p.size, height: p.size * 1.4, background: p.color,
          borderRadius: 2, animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', animation: 'badge-toast-in 1.8s ease forwards',
        background: 'linear-gradient(160deg,#f0cc70,#a07018)', color: '#2a1808',
        fontWeight: 900, fontSize: 15, padding: '12px 22px', borderRadius: 14,
        boxShadow: '0 10px 30px rgba(0,0,0,.5)', whiteSpace: 'nowrap',
      }}>
        {emoji} Badge débloqué : {label}
      </div>
    </div>,
    document.body
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function BadgeBox({ userId, isOwner }: { userId: string; isOwner?: boolean }) {
  const [data, setData]       = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [mounted, setMounted] = useState(false)
  const [celebration, setCelebration] = useState<{ label: string; emoji: string } | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase.rpc('get_user_badge_data', { p_user_id: userId })
      .then(({ data: rows }) => {
        if (rows?.[0]) setData(rows[0] as BadgeData)
        setLoading(false)
        supabase.rpc('compute_user_badges', { p_user_id: userId }).then(() => {}, () => {})
      })
  }, [userId])

  const statMap: Record<string, number> = data ? {
    cartes: data.stat_total, rc: data.stat_rc, patch: data.stat_patch,
    num: data.stat_num, mois: data.mois_count,
    views: Number(data.views_count), teams: data.teams_count,
  } : {}

  const earned = new Set<string>()
  for (const cat of BADGE_CATEGORIES) {
    const v = statMap[cat.id] ?? 0
    for (const t of cat.tiers) { if (v >= t.threshold) earned.add(t.id) }
  }
  const earnedKey = Array.from(earned).sort().join(',')

  // Détecte les badges nouvellement débloqués (uniquement sur sa propre galerie)
  // et déclenche célébration (confetti + vibration + toast) et, à partir du
  // 2e badge débloqué sur l'appareil, une invitation à noter l'app.
  useEffect(() => {
    if (!isOwner || !data || !userId || !earnedKey) return
    const storageKey = `badges-seen-${userId}`
    const seenRaw = localStorage.getItem(storageKey)
    const currentIds = earnedKey.split(',')
    if (seenRaw === null) {
      // Première mesure sur cet appareil : sert de référence, pas de célébration
      // (sinon on fêterait d'un coup tous les badges déjà acquis avant ce jour).
      localStorage.setItem(storageKey, JSON.stringify(currentIds))
      return
    }
    const seen = new Set<string>(JSON.parse(seenRaw))
    const newlyEarnedIds = currentIds.filter(id => !seen.has(id))
    if (newlyEarnedIds.length === 0) return
    localStorage.setItem(storageKey, JSON.stringify(currentIds))

    let best: { cat: BadgeCategory; tier: BadgeTier; tierIdx: number } | null = null
    for (const cat of BADGE_CATEGORIES) {
      cat.tiers.forEach((tier, tierIdx) => {
        if (newlyEarnedIds.includes(tier.id) && (!best || tierIdx > best.tierIdx)) {
          best = { cat, tier, tierIdx }
        }
      })
    }
    if (!best) return
    const { cat, tier } = best as { cat: BadgeCategory; tier: BadgeTier; tierIdx: number }

    hapticSuccess()
    toast.success(`${cat.emoji} Nouveau badge débloqué : ${tier.label} ${cat.unit} !`)
    setCelebration({ label: `${tier.label} ${cat.unit}`, emoji: cat.emoji })
    setTimeout(() => setCelebration(null), 1800)

    const totalKey = 'badges-total-earned-count'
    const total = Number(localStorage.getItem(totalKey) || '0') + newlyEarnedIds.length
    localStorage.setItem(totalKey, String(total))
    if (total >= 2) maybePromptReview()
  }, [earnedKey, isOwner, userId, !!data])

  if (loading) return (
    <div style={{ background: '#180828', borderRadius: 16, padding: 48, textAlign: 'center', color: '#7c3aed', fontSize: 13 }}>
      Chargement des badges…
    </div>
  )
  if (!data) return null

  return (
    <div>
      {celebration && <ConfettiBurst label={celebration.label} emoji={celebration.emoji} />}
      <style>{`
        @keyframes holo-badge {
          0%,100% { filter: hue-rotate(0deg) brightness(1.1) }
          33%      { filter: hue-rotate(60deg) brightness(1.3) }
          66%      { filter: hue-rotate(120deg) brightness(1.15) }
        }
        @keyframes tooltip-in {
          from { opacity:0; transform:translate(-50%,-88%) }
          to   { opacity:1; transform:translate(-50%,-100%) }
        }
      `}</style>

      <div style={{ perspective: '900px', perspectiveOrigin: '50% 15%' }}>
        <div style={{
          transform: 'rotateX(10deg)', transformOrigin: 'center 65%',
          background: 'linear-gradient(160deg,#f0cc70 0%,#c89428 20%,#a07018 45%,#c89428 70%,#f0cc70 100%)',
          borderRadius: 18, padding: '0 0 8px',
          boxShadow: '0 28px 70px rgba(0,0,0,.8),0 10px 28px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.35)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Grain bois */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 18, backgroundImage: 'repeating-linear-gradient(87deg,transparent 0px,rgba(0,0,0,.06) 1px,transparent 3px,transparent 12px)', pointerEvents: 'none' }} />

          {/* Moulure */}
          <div style={{ height: 28, background: 'linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(0,0,0,.15) 100%)', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 11, color: '#6b3c00', letterSpacing: '.18em', textTransform: 'uppercase', textShadow: '0 1px 0 rgba(255,255,255,.25)' }}>✦ Badge Case ✦</span>
          </div>

          {/* Velours */}
          <div style={{
            margin: '0 10px',
            background: 'linear-gradient(170deg,#50124a 0%,#38083a 50%,#50124a 100%)',
            borderRadius: 8, padding: '16px 10px 24px',
            boxShadow: 'inset 0 6px 24px rgba(0,0,0,.75),inset 0 0 50px rgba(90,0,90,.4)',
            position: 'relative', overflowX: 'auto',
          }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.015) 1px,transparent 1px)', backgroundSize: '6px 6px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: '5%', right: '5%', height: 40, background: 'radial-gradient(ellipse at 50% 100%,rgba(180,20,220,.55) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 400, position: 'relative' }}>
              {BADGE_CATEGORIES.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 17, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' }}>{cat.emoji}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'nowrap' }}>
                    {cat.tiers.map((tier, ti) => (
                      <Badge3D
                        key={tier.id}
                        cat={cat}
                        tier={tier}
                        tierIdx={ti}
                        totalTiers={cat.tiers.length}
                        isEarned={earned.has(tier.id)}
                        statVal={statMap[cat.id] ?? 0}
                        setTooltip={setTooltip}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pied */}
          <div style={{ height: 8, margin: '0 6px', background: 'linear-gradient(180deg,#a07018,#6a4a10)', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.4)' }} />
        </div>
      </div>

      {mounted && tooltip && createPortal(<BadgeTooltip t={tooltip} />, document.body)}
    </div>
  )
}
