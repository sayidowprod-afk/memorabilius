import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { verifyWrapSig } from '@/lib/wrapSign'

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
  if (n <= 8) return 4
  if (n <= 15) return 5
  if (n <= 24) return 6
  return 7
}

async function fetchAsB64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const ct = r.headers.get('content-type') || 'image/jpeg'
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')
  const y = parseInt(searchParams.get('y') || '0')
  const m = parseInt(searchParams.get('m') || '0')
  const format = (searchParams.get('format') || 'square') as 'square' | 'story'
  const sig = searchParams.get('sig') || ''

  if (!uid || !y || !m || !sig) {
    return new Response('Paramètres manquants', { status: 400 })
  }

  if (!verifyWrapSig(uid, y, m, format, sig)) {
    return new Response('Lien invalide ou expiré', { status: 403 })
  }

  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m, 1)
  const monthLabel = monthName(monthStart)

  const [{ data: profile }, { data: profiles }, { data: cardsData }] = await Promise.all([
    supabase.from('profiles').select('display_name, stats_total').eq('id', uid).single(),
    supabase.from('profiles').select('id, stats_total'),
    supabase.from('cartes_manuelles')
      .select('nom, annee, marque, rc, auto, patch, num, image_recto')
      .eq('user_id', uid)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString()),
  ])

  const ranked = [...(profiles || [])].sort((a, b) => (b.stats_total || 0) - (a.stats_total || 0))
  const rank = ranked.findIndex(p => p.id === uid) + 1
  const totalCollectors = ranked.length
  const name = profile?.display_name || 'Collector'
  const newCards = cardsData?.length || 0
  const rcCount = cardsData?.filter((c: any) => c.rc).length || 0
  const autoCount = cardsData?.filter((c: any) => c.auto).length || 0
  const patchCount = cardsData?.filter((c: any) => c.patch).length || 0
  const numCount = cardsData?.filter((c: any) => c.num).length || 0
  const totalCards = profile?.stats_total || 0
  const medals = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  const rawImages = sortedCardImages(cardsData || [])
  const ncols = colsForCount(rawImages.length, format)

  const rawRows: string[][] = []
  for (let i = 0; i < rawImages.length; i += ncols) {
    rawRows.push(rawImages.slice(i, i + ncols))
  }

  const b64Rows: (string | null)[][] = await Promise.all(
    rawRows.map(row => Promise.all(row.map(fetchAsB64)))
  )

  const BG = '#060d22'
  const ACCENT = '#003DA6'
  const GAP = format === 'story' ? 8 : 6

  const StatBox = ({ value, label }: { value: string | number; label: string }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14, padding: '14px 10px', flex: 1,
    }}>
      <div style={{ color: '#5B9FFF', fontSize: 30, fontWeight: 900, lineHeight: 1, display: 'flex' }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 5, textAlign: 'center', display: 'flex' }}>{label}</div>
    </div>
  )

  const CardGrid = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, overflow: 'hidden' }}>
      {b64Rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: GAP, flex: 1 }}>
          {row.map((src, ci) => (
            <div key={ci} style={{
              flex: 1, display: 'flex',
              background: '#0d1a30',
              borderRadius: format === 'story' ? 10 : 7,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {src && <img src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </div>
          ))}
          {Array.from({ length: ncols - row.length }).map((_, pi) => (
            <div key={`pad-${pi}`} style={{ flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  )

  const filename = `memorabilius-wrap-${y}-${String(m).padStart(2, '0')}-${format}.png`
  const headers = {
    'Content-Type': 'image/png',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, max-age=604800',
  }

  if (format === 'square') {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', background: BG,
          display: 'flex', flexDirection: 'column',
          padding: '44px 44px 36px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {LOGO_B64
              ? <img src={LOGO_B64} width={160} height={32} style={{ objectFit: 'contain', opacity: 0.9 }} />
              : <div style={{ color: 'white', fontWeight: 900, fontSize: 18, display: 'flex' }}>MEMORABILIUS</div>
            }
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700, display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 18px' }}>
              Wrap {monthLabel}
            </div>
          </div>
          <CardGrid />
          <div style={{ display: 'flex', gap: '8px', marginTop: 16 }}>
            <StatBox value={newCards} label="Cartes" />
            <StatBox value={totalCards} label="Total" />
            <StatBox value={medals} label="Rang" />
            {rcCount > 0 && <StatBox value={rcCount} label="RC" />}
            {autoCount > 0 && <StatBox value={autoCount} label="Auto" />}
            {patchCount > 0 && <StatBox value={patchCount} label="Patch" />}
            {numCount > 0 && <StatBox value={numCount} label="Num." />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, display: 'flex' }}>memorabilius.fr</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15, display: 'flex', background: ACCENT, borderRadius: 50, padding: '6px 18px' }}>
              @{name}
            </div>
          </div>
        </div>
      ),
      { width: 1080, height: 1080, headers }
    )
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', background: BG,
        display: 'flex', flexDirection: 'column',
        padding: '60px 44px 44px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: 28 }}>
          {LOGO_B64
            ? <img src={LOGO_B64} width={190} height={38} style={{ objectFit: 'contain', opacity: 0.9 }} />
            : <div style={{ color: 'white', fontWeight: 900, fontSize: 22, display: 'flex' }}>MEMORABILIUS</div>
          }
          <div style={{ color: 'white', fontSize: 34, fontWeight: 900, display: 'flex' }}>Wrap {monthLabel}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, display: 'flex' }}>@{name}</div>
        </div>
        <CardGrid />
        <div style={{ display: 'flex', gap: '8px', marginTop: 24 }}>
          <StatBox value={newCards} label="Cartes ajoutées" />
          <StatBox value={medals} label={`/ ${totalCollectors}`} />
          {rcCount > 0 && <StatBox value={rcCount} label="RC" />}
          {autoCount > 0 && <StatBox value={autoCount} label="Auto" />}
          {patchCount > 0 && <StatBox value={patchCount} label="Patch" />}
          {numCount > 0 && <StatBox value={numCount} label="Num." />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, display: 'flex' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers }
  )
}
