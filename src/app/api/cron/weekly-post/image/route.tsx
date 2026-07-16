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

export async function GET(req: NextRequest) {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const [{ data: cards }, { data: allAdded }] = await Promise.all([
    supabase
      .from('cartes_manuelles')
      .select('nom, image_recto, annee, marque, rc, auto, patch, num, user_id')
      .not('image_recto', 'is', null)
      .gte('created_at', since.toISOString()),
    supabase
      .from('cartes_manuelles')
      .select('user_id')
      .gte('created_at', since.toISOString()),
  ])

  // Score cards, sort by rarity, take top 6
  const sorted = [...(cards || [])]
    .map(c => ({ ...c, _score: scoreCard(c) }))
    .sort((a, b) => b._score - a._score)

  const top6: typeof sorted = []
  const seen = new Set<string>()
  for (const c of sorted) {
    if (top6.length >= 6) break
    const key = c.image_recto as string
    if (!seen.has(key)) { seen.add(key); top6.push(c) }
  }

  // Weekly ranking
  const countByUser = new Map<string, number>()
  ;(allAdded || []).forEach(r => {
    countByUser.set(r.user_id, (countByUser.get(r.user_id) || 0) + 1)
  })
  const topUserIds = [...countByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const { data: profiles } = topUserIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', topUserIds)
    : { data: [] }

  const ranking = topUserIds.map((id, i) => ({
    name: (profiles || []).find(p => p.id === id)?.display_name || 'Collector',
    count: countByUser.get(id) || 0,
    rank: i + 1,
  }))

  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const CARD_W = 316
  const CARD_H = 280
  const GAP = 12

  const renderCard = (c: (typeof top6)[0] | undefined, i: number) => (
    <div key={i} style={{
      width: CARD_W, height: CARD_H,
      borderRadius: 12, overflow: 'hidden',
      background: '#0d1a3e',
      border: '1.5px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {c?.image_recto ? (
        <img src={c.image_recto}
          style={{ width: '100%', height: CARD_H - 28, objectFit: 'contain', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: CARD_H - 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.08)', fontSize: 40 }}>
          🃏
        </div>
      )}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4, background: 'rgba(0,0,0,0.4)' }}>
        {c?.rc    && <div style={{ background: '#e67e22', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>RC</div>}
        {c?.auto  && <div style={{ background: '#2e7d32', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>AUTO</div>}
        {c?.patch && <div style={{ background: '#6a1b9a', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>PATCH</div>}
        {c?.num   && <div style={{ background: '#1565c0', color: 'white', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 800, display: 'flex' }}>
          {(c.num.match(/\/\d+/) || [c.num])[0]}
        </div>}
        {c?.nom   && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, display: 'flex', overflow: 'hidden' }}>{c.nom.slice(0, 20)}</div>}
      </div>
    </div>
  )

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(145deg, #04091a 0%, #0a1640 60%, #050c1e 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '44px 48px', gap: 28,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: 'white', display: 'flex' }}>
              🃏 Cartes de la semaine
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', display: 'flex', letterSpacing: 1 }}>
              {dateStr}
            </div>
          </div>
          {LOGO_B64 && (
            <img src={LOGO_B64} width={160} height={32}
              style={{ objectFit: 'contain', opacity: 0.6, display: 'block' }} />
          )}
        </div>

        {/* Cards grid — 2 rows × 3 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          <div style={{ display: 'flex', gap: GAP }}>
            {[0, 1, 2].map(i => renderCard(top6[i], i))}
          </div>
          <div style={{ display: 'flex', gap: GAP }}>
            {[3, 4, 5].map(i => renderCard(top6[i], i))}
          </div>
        </div>

        {/* Ranking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.85)', display: 'flex', letterSpacing: 0.5 }}>
            🏆 Classement de la semaine
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {ranking.length > 0 ? ranking.map((r, i) => (
              <div key={i} style={{
                flex: 1, background: i === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)',
                border: i === 0 ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 20, display: 'flex' }}>{medal(r.rank)}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'white', display: 'flex' }}>{r.name.slice(0, 14)}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
                  {r.count} carte{r.count > 1 ? 's' : ''}
                </div>
              </div>
            )) : (
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14, display: 'flex' }}>
                Aucune activité cette semaine
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', display: 'flex' }}>memorabilius.fr</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', display: 'flex' }}>#cartes #cards #NBA #collection</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
