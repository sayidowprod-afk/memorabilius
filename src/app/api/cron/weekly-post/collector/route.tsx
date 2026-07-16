import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const W = 1080
const H = 1080

let LOGO_B64: string | null = null
try {
  const p = path.join(process.cwd(), 'public', 'memorabilius-logo-white.png')
  LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
} catch {}

function scoreCard(c: any): number {
  let s = 0
  const m = (c.num || '').match(/\/(\d+)/)
  if (m) s += 10000 / parseInt(m[1])
  if (c.auto)  s += 500
  if (c.rc)    s += 300
  if (c.patch) s += 200
  return s
}

export async function GET(_req: NextRequest) {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: added } = await supabase
    .from('cartes_manuelles')
    .select('user_id')
    .gte('created_at', since.toISOString())

  if (!added || added.length === 0) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', background: '#04091a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 24, fontFamily: 'system-ui' }}>
        Aucune activité cette semaine
      </div>,
      { width: W, height: H }
    )
  }

  const countByUser = new Map<string, number>()
  added.forEach(r => {
    countByUser.set(r.user_id, (countByUser.get(r.user_id) || 0) + 1)
  })

  const [topUserId] = [...countByUser.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const weekCount = countByUser.get(topUserId) || 0

  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url, stats_total, couleur_bordure, slug').eq('id', topUserId).single(),
    supabase.from('cartes_manuelles')
      .select('nom, image_recto, annee, marque, rc, auto, patch, num')
      .eq('user_id', topUserId)
      .not('image_recto', 'is', null)
      .gte('created_at', since.toISOString()),
  ])

  const name = profile?.display_name || 'Collector'
  const accent = profile?.couleur_bordure || '#003DA6'
  const avatar = profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003DA6&color=ffffff&size=256`

  const rcCount    = (cards || []).filter(c => c.rc).length
  const autoCount  = (cards || []).filter(c => c.auto).length
  const patchCount = (cards || []).filter(c => c.patch).length
  const numCount   = (cards || []).filter(c => c.num).length

  // Top 3 cards by score
  const top3 = [...(cards || [])]
    .map(c => ({ ...c, _score: scoreCard(c) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memorabilius.vercel.app'
  const galerieSlug = profile?.slug || topUserId

  const CARD_W = 240
  const CARD_H = 316

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(160deg, #04091a 0%, #0a1640 55%, #060e26 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '52px 60px', gap: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', display: 'flex' }}>
              Memorabilius · {dateStr}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: 'white', lineHeight: 1, display: 'flex' }}>
              ⭐ Collectionneur de la semaine
            </div>
          </div>
          {LOGO_B64 && (
            <img src={LOGO_B64} width={150} height={30}
              style={{ objectFit: 'contain', opacity: 0.5, display: 'block' }} />
          )}
        </div>

        {/* Main content: identity left + cards right */}
        <div style={{ display: 'flex', gap: 48, flex: 1 }}>
          {/* Left: avatar + name + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, width: 340, flexShrink: 0 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', display: 'flex' }}>
              <img src={avatar} width={160} height={160}
                style={{ borderRadius: '50%', objectFit: 'cover', border: `4px solid ${accent}`, display: 'block' }} />
              {/* Trophy badge */}
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 48, height: 48, borderRadius: '50%',
                background: '#c8a800', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, border: '3px solid #04091a',
              }}>
                🏆
              </div>
            </div>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: 'white', lineHeight: 1, display: 'flex' }}>
                {name}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                {profile?.stats_total?.toLocaleString('fr-FR') || 0} cartes au total
              </div>
            </div>

            {/* Week highlight */}
            <div style={{
              background: `${accent}22`, border: `1.5px solid ${accent}55`,
              borderRadius: 16, padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
            }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: 'white', lineHeight: 1, display: 'flex' }}>
                +{weekCount}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', display: 'flex' }}>
                cartes ajoutées cette semaine
              </div>
            </div>

            {/* Badge breakdown */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', width: '100%' }}>
              {rcCount > 0    && <div style={{ background: '#e67e2222', border: '1px solid #e67e2255', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#e67e22', display: 'flex' }}>{rcCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>RC</div>
              </div>}
              {autoCount > 0  && <div style={{ background: '#2e7d3222', border: '1px solid #2e7d3255', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#4caf50', display: 'flex' }}>{autoCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>Auto</div>
              </div>}
              {patchCount > 0 && <div style={{ background: '#6a1b9a22', border: '1px solid #6a1b9a55', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#ce93d8', display: 'flex' }}>{patchCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>Patch</div>
              </div>}
              {numCount > 0   && <div style={{ background: '#1565c022', border: '1px solid #1565c055', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#64b5f6', display: 'flex' }}>{numCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>Num.</div>
              </div>}
            </div>

            {/* CTA */}
            <div style={{ fontSize: 13, color: `${accent}cc`, display: 'flex', marginTop: 4 }}>
              {baseUrl.replace('https://', '')}/galerie/{galerieSlug}
            </div>
          </div>

          {/* Right: top 3 cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', display: 'flex' }}>
              Ses meilleures cartes
            </div>
            <div style={{ display: 'flex', gap: 16, flex: 1 }}>
              {[0, 1, 2].map(i => {
                const c = top3[i]
                return (
                  <div key={i} style={{
                    flex: 1, borderRadius: 14, overflow: 'hidden',
                    background: '#0d1a3e',
                    border: '1.5px solid rgba(255,255,255,0.07)',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {c?.image_recto ? (
                      <img src={c.image_recto}
                        style={{ width: '100%', flex: 1, objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.06)', fontSize: 36 }}>
                        🃏
                      </div>
                    )}
                    {c && (
                      <div style={{ padding: '6px 8px', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.4)', flexWrap: 'nowrap' }}>
                        {c.rc    && <div style={{ background: '#e67e22', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>RC</div>}
                        {c.auto  && <div style={{ background: '#2e7d32', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>AUTO</div>}
                        {c.num   && <div style={{ background: '#1565c0', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>
                          {(c.num.match(/\/\d+/) || [c.num])[0]}
                        </div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', display: 'flex' }}>memorabilius.fr</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', display: 'flex' }}>#memorabilius #collectionneur #cards #NBA</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'no-store' } }
  )
}
