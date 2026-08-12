'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BADGE_CATEGORIES, TOTAL_BADGES } from '@/lib/badgeDefinitions'

type BadgeData = {
  earned_badges: string[]
  stat_total: number; stat_rc: number; stat_patch: number; stat_num: number
  mois_count: number; views_count: number; teams_count: number
}

// Shape différente par catégorie (clip-path CSS)
const CAT_CLIP: Record<string, string> = {
  cartes: 'polygon(50% 0%,79% 9%,100% 34%,100% 66%,79% 91%,50% 100%,21% 91%,0% 66%,0% 34%,21% 9%)', // décagone
  rc:     'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 71%,21% 91%,32% 57%,2% 35%,39% 35%)',  // étoile
  patch:  'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',                                                   // diamant
  num:    'polygon(50% 2%,93% 25%,93% 75%,50% 98%,7% 75%,7% 25%)',                                     // hexagone
  mois:   'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',                                         // pentagone
  views:  'polygon(0% 20%,60% 20%,100% 50%,60% 80%,0% 80%)',                                           // flèche/bouclier
  teams:  'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',                                  // hexagone large
}

// Couleurs par palier (Bronze → Argent → Or → Saphir → Diamant)
const TIER = [
  { face: 'linear-gradient(145deg,#a06818 0%,#e8a828 40%,#f8c840 55%,#b07820 100%)', bottom: '#6a4010', glow: '#d49020', text: '#fff8e0' },
  { face: 'linear-gradient(145deg,#585858 0%,#b8b8b8 40%,#e8e8e8 55%,#787878 100%)', bottom: '#282828', glow: '#b8b8b8', text: '#f0f0f0' },
  { face: 'linear-gradient(145deg,#887000 0%,#d8a000 40%,#f8e018 55%,#a86800 100%)', bottom: '#584000', glow: '#e8b800', text: '#fff8b0' },
  { face: 'linear-gradient(145deg,#004888 0%,#0888d8 40%,#50c0f8 55%,#005898 100%)', bottom: '#002858', glow: '#30a0f0', text: '#c0e8ff' },
  { face: 'linear-gradient(145deg,#580088 0%,#a818e0 25%,#e838f8 50%,#7820c8 75%,#580088 100%)', bottom: '#300058', glow: '#c030f0', text: '#f8d8ff', holo: true },
]

function fmtN(n: number) { return n >= 1000 ? `${(n/1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n) }

// ── Badge 3D individuel ────────────────────────────────────────────────────
function Badge3D({ catId, tierIdx, tierLabel, unit, isEarned, emoji }: {
  catId: string; tierIdx: number; tierLabel: string; unit: string
  isEarned: boolean; emoji: string
}) {
  const clip = CAT_CLIP[catId] ?? 'circle(46%)'
  const pal  = TIER[Math.min(tierIdx, TIER.length - 1)]
  const tip  = isEarned ? `${emoji} ${tierLabel} ${unit}` : `Objectif : ${tierLabel} ${unit}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
      <div
        title={tip}
        style={{
          width: 52, height: 52, position: 'relative', flexShrink: 0,
          transition: 'transform .2s, filter .2s',
          filter: isEarned ? `drop-shadow(0 0 10px ${pal.glow}) drop-shadow(0 3px 6px rgba(0,0,0,.6))` : 'none',
        }}
        onMouseEnter={e => { if (isEarned) (e.currentTarget as HTMLElement).style.transform = 'translateY(-7px) scale(1.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
      >
        {isEarned ? (<>
          {/* Épaisseur / tranche inférieure */}
          <div style={{ position: 'absolute', inset: 0, top: 5, background: pal.bottom, clipPath: clip }} />
          {/* Face principale */}
          <div style={{
            position: 'absolute', inset: 0,
            background: pal.face, clipPath: clip,
            animation: pal.holo ? 'holo-badge 2.5s ease infinite' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Reflet lumière */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,.05) 45%,transparent 55%)', pointerEvents: 'none' }} />
            <span style={{ fontSize: 19, lineHeight: 1, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}>{emoji}</span>
          </div>
        </>) : (
          /* Slot vide — enfoncé dans le velours */
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 40% 30%, #2e1048, #160820)',
            clipPath: clip,
            boxShadow: 'inset 0 3px 10px rgba(0,0,0,.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: .55,
          }}>
            <span style={{ fontSize: 9, color: '#4a1870' }}>—</span>
          </div>
        )}
      </div>
      {/* Label du palier */}
      <div style={{
        fontSize: 8, fontWeight: 800, marginTop: 3,
        color: isEarned ? pal.glow : '#3a1858',
        textShadow: isEarned ? `0 0 8px ${pal.glow}` : 'none',
        letterSpacing: '.02em', textAlign: 'center', lineHeight: 1,
      }}>
        {tierLabel}
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────
export default function BadgeBox({ userId }: { userId: string }) {
  const [data, setData]       = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase.rpc('compute_user_badges', { p_user_id: userId })
      .then(() => supabase.rpc('get_user_badge_data', { p_user_id: userId }))
      .then(({ data: rows }) => {
        if (rows?.[0]) setData(rows[0] as BadgeData)
        setLoading(false)
      })
  }, [userId])

  if (loading) return (
    <div style={{ background: '#180828', borderRadius: 16, padding: 48, textAlign: 'center', color: '#7c3aed', fontSize: 13 }}>
      Chargement des badges…
    </div>
  )
  if (!data) return null

  const earned = new Set(data.earned_badges || [])
  const earnedCount = earned.size
  const pct = Math.round(earnedCount / TOTAL_BADGES * 100)

  return (
    <div>
      <style>{`
        @keyframes holo-badge {
          0%   { filter: hue-rotate(0deg)   brightness(1.05); }
          50%  { filter: hue-rotate(40deg)  brightness(1.2);  }
          100% { filter: hue-rotate(0deg)   brightness(1.05); }
        }
      `}</style>

      {/* ════ BOÎTE 3D ════ */}
      <div style={{ perspective: '900px', perspectiveOrigin: '50% 15%', marginBottom: 20 }}>
        <div style={{
          transform: 'rotateX(10deg)',
          transformOrigin: 'center 65%',
          /* Cadre en bois */
          background: 'linear-gradient(160deg, #f0cc70 0%, #c89428 20%, #a07018 45%, #c89428 70%, #f0cc70 100%)',
          borderRadius: 18,
          padding: '0 0 8px',
          boxShadow: '0 28px 70px rgba(0,0,0,.8), 0 10px 28px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.35)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Grain de bois */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(87deg, transparent 0px, rgba(0,0,0,.06) 1px, transparent 3px, transparent 12px)', pointerEvents: 'none', borderRadius: 18 }} />

          {/* Bord supérieur — moulure */}
          <div style={{ height: 28, background: 'linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(0,0,0,.15) 100%)', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 11, color: '#6b3c00', letterSpacing: '.18em', textTransform: 'uppercase', textShadow: '0 1px 0 rgba(255,255,255,.25)' }}>✦ Badge Case ✦</span>
          </div>

          {/* Intérieur velours */}
          <div style={{
            margin: '0 10px',
            background: 'linear-gradient(170deg, #50124a 0%, #38083a 50%, #50124a 100%)',
            borderRadius: 8,
            padding: '14px 10px 20px',
            boxShadow: 'inset 0 6px 24px rgba(0,0,0,.75), inset 0 0 50px rgba(90,0,90,.4)',
            position: 'relative', overflowX: 'auto',
          }}>
            {/* Texture velours */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.015) 1px, transparent 1px)', backgroundSize: '6px 6px', pointerEvents: 'none' }} />
            {/* LED glow bas */}
            <div style={{ position: 'absolute', bottom: 0, left: '5%', right: '5%', height: 40, background: 'radial-gradient(ellipse at 50% 100%, rgba(180,20,220,.55) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Lignes de badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 340, position: 'relative' }}>
              {BADGE_CATEGORIES.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Icône catégorie */}
                  <div style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 17, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' }}>{cat.emoji}</span>
                  </div>
                  {/* Slots */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {cat.tiers.map((tier, tierIdx) => (
                      <Badge3D
                        key={tier.id}
                        catId={cat.id}
                        tierIdx={tierIdx}
                        tierLabel={tier.label}
                        unit={cat.unit}
                        isEarned={earned.has(tier.id)}
                        emoji={cat.emoji}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pied / base en bois */}
          <div style={{ height: 8, margin: '0 6px', background: 'linear-gradient(180deg,#a07018,#6a4a10)', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.4)' }} />
        </div>
      </div>

      {/* ════ PROGRESSION ════ */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1a2744)', borderRadius: 12, border: '1px solid #1e3a5f', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13, flex: 1 }}>Progression · {earnedCount}/{TOTAL_BADGES} badges</span>
          <div style={{ width: 80, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#a855f7)', borderRadius: 2, transition: '1.2s' }} />
          </div>
          <span style={{ color: '#475569', fontSize: 11 }}>{pct}%</span>
        </div>
        {BADGE_CATEGORIES.map(cat => {
          const statVal  = (data as unknown as Record<string, number>)[cat.statKey] ?? 0
          const nextTier = cat.tiers.find(t => !earned.has(t.id))
          const allDone  = !nextTier
          const pal      = nextTier ? TIER[Math.min(cat.tiers.indexOf(nextTier), TIER.length - 1)] : null
          const progress = nextTier ? Math.min(statVal / nextTier.threshold, 1) : 1

          return (
            <div key={cat.id} style={{ padding: '9px 16px', borderBottom: '1px solid #0f172a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: allDone ? 0 : 5 }}>
                <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                <span style={{ color: '#94a3b8', fontSize: 12, flex: 1 }}>{cat.label}</span>
                {allDone
                  ? <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Complété</span>
                  : <span style={{ fontSize: 11, color: '#475569' }}>{fmtN(statVal)} / {fmtN(nextTier!.threshold)} {cat.unit}</span>
                }
              </div>
              {!allDone && (
                <div style={{ height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress * 100}%`, background: pal?.glow ?? '#3b82f6', borderRadius: 2, transition: '1.2s ease' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
