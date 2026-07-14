import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let LOGO_B64: string | null = null
try {
  const logoPath = path.join(process.cwd(), 'public', 'memorabilius-logo-white.png')
  LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
} catch {}

function monthName(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function sortedCardImages(cards: any[]): string[] {
  const withImg = cards.filter(c => c.image_recto)
  return [
    ...withImg.filter(c => c.rc),
    ...withImg.filter(c => c.auto && !c.rc),
    ...withImg.filter(c => c.patch && !c.rc && !c.auto),
    ...withImg.filter(c => !c.rc && !c.auto && !c.patch),
  ].map(c => c.image_recto)
}

function colsForCount(n: number, format: 'square' | 'story') {
  if (format === 'story') {
    if (n <= 4) return 2
    if (n <= 9) return 3
    if (n <= 20) return 4
    return 5
  }
  // square
  if (n <= 8) return 4
  if (n <= 15) return 5
  if (n <= 24) return 6
  return 7
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Non authentifié', { status: 401 })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return new Response('Session invalide', { status: 401 })

  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'square') as 'square' | 'story'
  const period = (url.searchParams.get('period') || 'last') as 'current' | 'last'

  const now = new Date()
  const monthStart = period === 'current'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthEnd = period === 'current'
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLabel = monthName(monthStart)

  const [{ data: profile }, { data: profiles }, { data: cardsData }] = await Promise.all([
    supabase.from('profiles').select('display_name, stats_total').eq('id', user.id).single(),
    supabase.from('profiles').select('id, stats_total'),
    supabase.from('cartes_manuelles')
      .select('nom, annee, marque, rc, auto, patch, num, image_recto')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString()),
  ])

  const ranked = [...(profiles || [])].sort((a, b) => (b.stats_total || 0) - (a.stats_total || 0))
  const rank = ranked.findIndex(p => p.id === user.id) + 1
  const totalCollectors = ranked.length
  const name = profile?.display_name || user.email?.split('@')[0] || 'Collector'
  const newCards = cardsData?.length || 0
  const rcCount = cardsData?.filter((c: any) => c.rc).length || 0
  const autoCount = cardsData?.filter((c: any) => c.auto).length || 0
  const patchCount = cardsData?.filter((c: any) => c.patch).length || 0
  const numCount = cardsData?.filter((c: any) => c.num).length || 0
  const totalCards = profile?.stats_total || 0
  const medals = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
  const cardImages = sortedCardImages(cardsData || [])

  const BG = '#060d22'
  const ACCENT = '#003DA6'
  const ncols = colsForCount(cardImages.length, format)
  const pct = `${(100 / ncols).toFixed(4)}%`

  const CardTile = ({ src }: { src: string }) => (
    <div style={{
      width: pct,
      padding: format === 'story' ? '4px' : '3px',
      display: 'flex',
    }}>
      <div style={{
        display: 'flex',
        width: '100%',
        aspectRatio: '2.5 / 3.5',
        background: '#0d1a30',
        borderRadius: format === 'story' ? 10 : 7,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <img
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>
  )

  const StatBox = ({ value, label }: { value: string | number; label: string }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14, padding: '14px 10px', flex: 1,
    }}>
      <div style={{ color: '#5B9FFF', fontSize: 30, fontWeight: 900, lineHeight: 1, display: 'flex' }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 5, textAlign: 'center', display: 'flex' }}>{label}</div>
    </div>
  )

  if (format === 'square') {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%',
          background: BG,
          display: 'flex', flexDirection: 'column',
          padding: '44px 44px 36px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {LOGO_B64
              ? <img src={LOGO_B64} width={160} height={32} style={{ objectFit: 'contain', opacity: 0.9 }} />
              : <div style={{ color: 'white', fontWeight: 900, fontSize: 18, display: 'flex' }}>MEMORABILIUS</div>
            }
            <div style={{
              color: 'white', fontSize: 20, fontWeight: 700, display: 'flex',
              background: 'rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 18px',
            }}>
              Wrap {monthLabel}
            </div>
          </div>

          {/* Cards grid */}
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', overflow: 'hidden' }}>
            {cardImages.map((src, i) => <CardTile key={i} src={src} />)}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '10px', marginTop: 18 }}>
            <StatBox value={newCards} label="Cartes" />
            <StatBox value={totalCards} label="Total" />
            <StatBox value={medals} label="Rang" />
            {rcCount > 0 && <StatBox value={rcCount} label="RC" />}
            {autoCount > 0 && <StatBox value={autoCount} label="Auto" />}
            {patchCount > 0 && <StatBox value={patchCount} label="Patch" />}
            {numCount > 0 && <StatBox value={numCount} label="Num." />}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, display: 'flex' }}>memorabilius.fr</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16, display: 'flex', background: ACCENT, borderRadius: 50, padding: '6px 18px' }}>
              @{name}
            </div>
          </div>
        </div>
      ),
      { width: 1080, height: 1080, headers: { 'Content-Type': 'image/png' } }
    )
  }

  // Story 1080×1920
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: BG,
        display: 'flex', flexDirection: 'column',
        padding: '60px 44px 44px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: 32 }}>
          {LOGO_B64
            ? <img src={LOGO_B64} width={200} height={40} style={{ objectFit: 'contain', opacity: 0.9 }} />
            : <div style={{ color: 'white', fontWeight: 900, fontSize: 24, display: 'flex' }}>MEMORABILIUS</div>
          }
          <div style={{ color: 'white', fontSize: 36, fontWeight: 900, display: 'flex' }}>Wrap {monthLabel}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 20, display: 'flex' }}>@{name}</div>
        </div>

        {/* Cards grid — all cards, full ratio, no crop */}
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', overflow: 'hidden' }}>
          {cardImages.map((src, i) => <CardTile key={i} src={src} />)}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 28 }}>
          <StatBox value={newCards} label="Cartes ajoutées" />
          <StatBox value={medals} label={`/ ${totalCollectors}`} />
          {rcCount > 0 && <StatBox value={rcCount} label="RC" />}
          {autoCount > 0 && <StatBox value={autoCount} label="Auto" />}
          {patchCount > 0 && <StatBox value={patchCount} label="Patch" />}
          {numCount > 0 && <StatBox value={numCount} label="Num." />}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, display: 'flex' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { 'Content-Type': 'image/png' } }
  )
}
