'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES, TOTAL_BADGES } from '@/lib/badgeDefinitions'

type BadgeData = {
  earned_badges: string[]
  stat_total: number; stat_rc: number; stat_patch: number; stat_num: number
  mois_count: number; views_count: number; teams_count: number
}

type TooltipInfo = {
  x: number; y: number; above: boolean
  catLabel: string; catEmoji: string
  tierLabel: string; unit: string; tierIdx: number
  isEarned: boolean
  statVal: number; threshold: number
}

const CAT_CLIP: Record<string, string> = {
  cartes: 'polygon(50% 0%,79% 9%,100% 34%,100% 66%,79% 91%,50% 100%,21% 91%,0% 66%,0% 34%,21% 9%)',
  rc:     'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 71%,21% 91%,32% 57%,2% 35%,39% 35%)',
  patch:  'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
  num:    'polygon(50% 2%,93% 25%,93% 75%,50% 98%,7% 75%,7% 25%)',
  mois:   'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',
  views:  'polygon(0% 20%,60% 20%,100% 50%,60% 80%,0% 80%)',
  teams:  'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
}

// 8 niveaux : Bois → Pierre → Fer → Bronze → Argent → Or → Saphir → Diamant
// La couleur est choisie proportionnellement selon la position dans les paliers de la catégorie
const TIER_NAMES = ['Bois', 'Pierre', 'Fer', 'Bronze', 'Argent', 'Or', 'Saphir', 'Diamant']
const TIER = [
  { face: 'linear-gradient(145deg,#5c3a18 0%,#9a6028 40%,#c07838 55%,#7a4820 100%)', bottom: '#3a2010', glow: '#9a6028', border: '#c0783888' },
  { face: 'linear-gradient(145deg,#484848 0%,#888888 40%,#aaaaaa 55%,#686868 100%)', bottom: '#242424', glow: '#909090', border: '#aaaaaa88' },
  { face: 'linear-gradient(145deg,#283858 0%,#4878a8 40%,#70a0c8 55%,#405878 100%)', bottom: '#182038', glow: '#6080a8', border: '#70a0c888' },
  { face: 'linear-gradient(145deg,#a06818 0%,#e8a828 40%,#f8c840 55%,#b07820 100%)', bottom: '#6a4010', glow: '#d49020', border: '#f8c84088' },
  { face: 'linear-gradient(145deg,#585858 0%,#b8b8b8 40%,#e8e8e8 55%,#787878 100%)', bottom: '#282828', glow: '#c8c8c8', border: '#e8e8e888' },
  { face: 'linear-gradient(145deg,#887000 0%,#d8a000 40%,#f8e018 55%,#a86800 100%)', bottom: '#584000', glow: '#e8c000', border: '#f8e01888' },
  { face: 'linear-gradient(145deg,#004888 0%,#0888d8 40%,#50c0f8 55%,#005898 100%)', bottom: '#002858', glow: '#30a8f8', border: '#50c0f888' },
  { face: 'linear-gradient(145deg,#580088 0%,#a818e0 25%,#e838f8 50%,#7820c8 75%,#580088 100%)', bottom: '#300058', glow: '#d838f8', border: '#e838f888', holo: true },
]

// Distribution proportionnelle : tier 0 → Bois, tier max → Diamant, quelle que soit la catégorie
function tierColorIdx(tierIdx: number, totalTiers: number): number {
  if (totalTiers <= 1) return TIER.length - 1
  return Math.round((tierIdx / (totalTiers - 1)) * (TIER.length - 1))
}

function fmtN(n: number) { return n >= 1000 ? `${(n/1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n) }

// ── Tooltip portal ─────────────────────────────────────────────────────────
function BadgeTooltip({ t }: { t: TooltipInfo }) {
  const pal  = TIER[Math.min(t.tierIdx, TIER.length - 1)]
  const pct  = Math.min(t.statVal / t.threshold, 1)
  const yPos = t.above ? t.y - 12 : t.y + 64

  return (
    <div style={{
      position: 'fixed', left: t.x, top: yPos,
      transform: t.above ? 'translate(-50%,-100%)' : 'translate(-50%,0)',
      zIndex: 99999, pointerEvents: 'none',
      background: 'linear-gradient(145deg,#0d1b2e,#162438)',
      border: `1px solid ${pal.border}`,
      borderRadius: 12, padding: '12px 16px', minWidth: 200,
      boxShadow: `0 8px 32px rgba(0,0,0,.8), 0 0 20px ${pal.glow}44, inset 0 1px 0 rgba(255,255,255,.05)`,
      animation: 'tooltip-in .15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, flexShrink: 0, position: 'relative',
          filter: t.isEarned ? `drop-shadow(0 0 6px ${pal.glow})` : 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0, top: 3,
            background: pal.bottom, clipPath: CAT_CLIP[t.catLabel] ?? 'circle(46%)',
            opacity: t.isEarned ? 1 : 0.4,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: t.isEarned ? pal.face : 'radial-gradient(#2a1048,#160820)',
            clipPath: CAT_CLIP[t.catLabel] ?? 'circle(46%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
            {t.isEarned ? t.catEmoji : '🔒'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>{t.catEmoji} {t.catLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.isEarned ? pal.glow : '#94a3b8', lineHeight: 1.3 }}>
            {t.isEarned ? '✓ ' : '🔒 '}{TIER_NAMES[t.tierIdx]}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, marginBottom: t.isEarned ? 0 : 8 }}>
        {t.tierLabel} {t.unit}
      </div>
      {!t.isEarned && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 4 }}>
          <span>Progression</span>
          <span>{fmtN(t.statVal)} / {fmtN(t.threshold)}</span>
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

// ── Badge 3D individuel ────────────────────────────────────────────────────
function Badge3D({ catId, catLabel, tierIdx, totalTiers, tierLabel, unit, isEarned, emoji, statVal, threshold, setTooltip }: {
  catId: string; catLabel: string; tierIdx: number; totalTiers: number; tierLabel: string
  unit: string; isEarned: boolean; emoji: string
  statVal: number; threshold: number
  setTooltip: (t: TooltipInfo | null) => void
}) {
  const clip = CAT_CLIP[catId] ?? 'circle(46%)'
  const pal  = TIER[tierColorIdx(tierIdx, totalTiers)]

  const showTooltip = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      above: rect.top > 200,
      catLabel, catEmoji: emoji,
      tierLabel, unit, tierIdx: tierColorIdx(tierIdx, totalTiers),
      isEarned, statVal, threshold,
    })
  }

  const defaultFilter = isEarned
    ? `drop-shadow(0 0 10px ${pal.glow}) drop-shadow(0 3px 6px rgba(0,0,0,.6))`
    : 'none'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div
        style={{
          width: 52, height: 52, position: 'relative', flexShrink: 0,
          transition: 'transform .28s cubic-bezier(.17,.67,.32,1.4), filter .28s ease',
          filter: defaultFilter, cursor: 'default',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          if (isEarned) {
            el.style.transform = 'translateY(-14px) scale(1.22) rotateY(18deg)'
            el.style.filter = `drop-shadow(0 0 22px ${pal.glow}) drop-shadow(0 0 48px ${pal.glow}88) drop-shadow(0 14px 10px rgba(0,0,0,.75))`
          } else {
            el.style.transform = 'translateY(-5px) scale(1.08)'
            el.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,.6))'
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
        {isEarned ? (<>
          <div style={{ position: 'absolute', inset: 0, top: 5, background: pal.bottom, clipPath: clip }} />
          <div style={{
            position: 'absolute', inset: 0, background: pal.face, clipPath: clip,
            animation: pal.holo ? 'holo-badge 2.5s ease infinite' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,.05) 45%,transparent 55%)', pointerEvents: 'none' }} />
            <span style={{ fontSize: 19, lineHeight: 1, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>{emoji}</span>
          </div>
        </>) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 40% 30%, #2e1048, #160820)',
            clipPath: clip, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: .6,
          }}>
            <span style={{ fontSize: 9, color: '#4a1870' }}>—</span>
          </div>
        )}
      </div>
      <div style={{
        fontSize: 8, fontWeight: 800, marginTop: 3,
        color: isEarned ? pal.glow : '#3a1858',
        textShadow: isEarned ? `0 0 8px ${pal.glow}` : 'none',
        letterSpacing: '.02em', textAlign: 'center', lineHeight: 1,
      }}>{tierLabel}</div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────
export default function BadgeBox({ userId }: { userId: string }) {
  const [data, setData]       = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase.rpc('get_user_badge_data', { p_user_id: userId })
      .then(({ data: rows }) => {
        if (rows?.[0]) setData(rows[0] as BadgeData)
        setLoading(false)
        // Persistance en arrière-plan (fire-and-forget, non bloquant)
        supabase.rpc('compute_user_badges', { p_user_id: userId }).catch(() => {})
      })
  }, [userId])

  if (loading) return (
    <div style={{ background: '#180828', borderRadius: 16, padding: 48, textAlign: 'center', color: '#7c3aed', fontSize: 13 }}>
      Chargement des badges…
    </div>
  )
  if (!data) return null

  const statMap: Record<string, number> = {
    cartes: data.stat_total, rc: data.stat_rc, patch: data.stat_patch,
    num: data.stat_num, mois: data.mois_count,
    views: Number(data.views_count), teams: data.teams_count,
  }

  // Calcul local des badges gagnés depuis les stats — ne dépend plus de compute_user_badges
  const earned = new Set<string>()
  for (const cat of BADGE_CATEGORIES) {
    const statVal = statMap[cat.id] ?? 0
    for (const tier of cat.tiers) {
      if (statVal >= tier.threshold) earned.add(tier.id)
    }
  }

  return (
    <div>
      <style>{`
        @keyframes holo-badge { 0%,100%{filter:hue-rotate(0deg) brightness(1.05)} 50%{filter:hue-rotate(40deg) brightness(1.25)} }
        @keyframes tooltip-in { from{opacity:0;transform:translate(-50%,-90%)} to{opacity:1;transform:translate(-50%,-100%)} }
      `}</style>

      {/* ════ BOÎTE 3D ════ */}
      <div style={{ perspective: '900px', perspectiveOrigin: '50% 15%' }}>
        <div style={{
          transform: 'rotateX(10deg)', transformOrigin: 'center 65%',
          background: 'linear-gradient(160deg,#f0cc70 0%,#c89428 20%,#a07018 45%,#c89428 70%,#f0cc70 100%)',
          borderRadius: 18, padding: '0 0 8px',
          boxShadow: '0 28px 70px rgba(0,0,0,.8),0 10px 28px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.35)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Grain de bois */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 18, backgroundImage: 'repeating-linear-gradient(87deg,transparent 0px,rgba(0,0,0,.06) 1px,transparent 3px,transparent 12px)', pointerEvents: 'none' }} />

          {/* Moulure supérieure */}
          <div style={{ height: 28, background: 'linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(0,0,0,.15) 100%)', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 11, color: '#6b3c00', letterSpacing: '.18em', textTransform: 'uppercase', textShadow: '0 1px 0 rgba(255,255,255,.25)' }}>✦ Badge Case ✦</span>
          </div>

          {/* Velours */}
          <div style={{
            margin: '0 10px',
            background: 'linear-gradient(170deg,#50124a 0%,#38083a 50%,#50124a 100%)',
            borderRadius: 8, padding: '14px 10px 20px',
            boxShadow: 'inset 0 6px 24px rgba(0,0,0,.75),inset 0 0 50px rgba(90,0,90,.4)',
            position: 'relative', overflowX: 'auto',
          }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.015) 1px,transparent 1px)', backgroundSize: '6px 6px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: '5%', right: '5%', height: 40, background: 'radial-gradient(ellipse at 50% 100%,rgba(180,20,220,.55) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 340, position: 'relative' }}>
              {BADGE_CATEGORIES.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 17, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' }}>{cat.emoji}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {cat.tiers.map((tier, tierIdx) => (
                      <Badge3D
                        key={tier.id}
                        catId={cat.id}
                        catLabel={cat.label}
                        tierIdx={tierIdx}
                        totalTiers={cat.tiers.length}
                        tierLabel={tier.label}
                        unit={cat.unit}
                        isEarned={earned.has(tier.id)}
                        emoji={cat.emoji}
                        statVal={statMap[cat.id] ?? 0}
                        threshold={tier.threshold}
                        setTooltip={setTooltip}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pied en bois */}
          <div style={{ height: 8, margin: '0 6px', background: 'linear-gradient(180deg,#a07018,#6a4a10)', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.4)' }} />
        </div>
      </div>

      {/* Tooltip portal — hors du contexte perspective */}
      {mounted && tooltip && createPortal(<BadgeTooltip t={tooltip} />, document.body)}
    </div>
  )
}
