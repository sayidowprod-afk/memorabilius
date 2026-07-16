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

export async function GET(_req: NextRequest) {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: added } = await supabase
    .from('cartes_manuelles')
    .select('user_id')
    .gte('created_at', since.toISOString())

  const countByUser = new Map<string, number>()
  ;(added || []).forEach(r => {
    countByUser.set(r.user_id, (countByUser.get(r.user_id) || 0) + 1)
  })

  const topUserIds = [...countByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const { data: profiles } = topUserIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_url, stats_total').in('id', topUserIds)
    : { data: [] }

  const ranking = topUserIds.map((id, i) => {
    const p = (profiles || []).find(p => p.id === id)
    return {
      id,
      name: p?.display_name || 'Collector',
      avatar: p?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p?.display_name || 'C')}&background=003DA6&color=ffffff&size=128`,
      total: p?.stats_total || 0,
      count: countByUser.get(id) || 0,
      rank: i + 1,
    }
  })

  const maxCount = ranking[0]?.count || 1
  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}`
  const medalBg = (r: number) => r === 1 ? '#c8a800' : r === 2 ? '#9e9e9e' : r === 3 ? '#c17a3a' : '#1e2a4a'
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(160deg, #04091a 0%, #0a1640 50%, #060e26 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '52px 60px', gap: 36,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', display: 'flex' }}>
              Memorabilius · {dateStr}
            </div>
            <div style={{ fontSize: 46, fontWeight: 900, color: 'white', lineHeight: 1, display: 'flex' }}>
              🏆 Classement
            </div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)', display: 'flex' }}>
              Cartes ajoutées cette semaine
            </div>
          </div>
          {LOGO_B64 && (
            <img src={LOGO_B64} width={150} height={30}
              style={{ objectFit: 'contain', opacity: 0.5, display: 'block', marginTop: 8 }} />
          )}
        </div>

        {/* Podium top 3 */}
        {ranking.slice(0, 3).map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 24,
            background: i === 0 ? 'rgba(200,168,0,0.08)' : i === 1 ? 'rgba(158,158,158,0.06)' : 'rgba(193,122,58,0.06)',
            border: `1.5px solid ${i === 0 ? 'rgba(200,168,0,0.25)' : i === 1 ? 'rgba(158,158,158,0.15)' : 'rgba(193,122,58,0.15)'}`,
            borderRadius: 18, padding: '20px 28px',
          }}>
            {/* Rank badge */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: medalBg(r.rank),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: i === 0 ? 26 : 20, fontWeight: 900, flexShrink: 0,
            }}>
              {medal(r.rank)}
            </div>

            {/* Avatar */}
            <img src={r.avatar} width={56} height={56}
              style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.15)', display: 'block', flexShrink: 0 }} />

            {/* Name + total */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <div style={{ fontSize: i === 0 ? 26 : 22, fontWeight: 900, color: 'white', display: 'flex' }}>
                {r.name}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
                {r.total.toLocaleString('fr-FR')} cartes au total
              </div>
            </div>

            {/* Count + bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <div style={{ fontSize: i === 0 ? 42 : 34, fontWeight: 900, color: i === 0 ? '#ffd700' : 'white', lineHeight: 1, display: 'flex' }}>
                {r.count}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                carte{r.count > 1 ? 's' : ''} cette semaine
              </div>
              {/* Progress bar */}
              <div style={{ width: 140, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${(r.count / maxCount) * 100}%`, height: '100%', background: i === 0 ? '#ffd700' : i === 1 ? '#ccc' : '#c17a3a', borderRadius: 2, display: 'flex' }} />
              </div>
            </div>
          </div>
        ))}

        {/* #4 et #5 */}
        {ranking.length > 3 && (
          <div style={{ display: 'flex', gap: 16 }}>
            {ranking.slice(3).map(r => (
              <div key={r.id} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 16,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: '16px 20px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#1e2a4a', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'rgba(255,255,255,0.5)', flexShrink: 0,
                }}>
                  {r.rank}
                </div>
                <img src={r.avatar} width={40} height={40}
                  style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'white', display: 'flex' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>{r.count} carte{r.count > 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', display: 'flex' }}>memorabilius.fr</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.15)', display: 'flex' }}>#memorabilius #cartes #cards #collection</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'no-store' } }
  )
}
