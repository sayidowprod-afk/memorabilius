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

  const BG = 'linear-gradient(145deg, #04091a 0%, #0b1840 60%, #060d22 100%)'
  const ACCENT = '#003DA6'

  const StatBox = ({ value, label, small }: { value: string | number; label: string; small?: boolean }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, padding: small ? '14px 10px' : '20px 14px', flex: 1,
    }}>
      <div style={{ color: '#5B9FFF', fontSize: small ? 28 : 38, fontWeight: 900, lineHeight: 1, display: 'flex' }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: small ? 11 : 13, marginTop: 5, textAlign: 'center', display: 'flex' }}>{label}</div>
    </div>
  )

  const CardImg = ({ src }: { src: string }) => (
    <div style={{
      display: 'flex', flex: 1, borderRadius: 10, overflow: 'hidden',
      border: '1.5px solid rgba(255,255,255,0.12)',
    }}>
      <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )

  const EmptyCard = () => (
    <div style={{
      display: 'flex', flex: 1, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 28, display: 'flex' }}>+</div>
    </div>
  )

  if (format === 'square') {
    const W = 1080, H = 1080
    const imgs = cardImages.slice(0, 8)
    const rows = imgs.length >= 4
      ? [imgs.slice(0, 4), imgs.slice(4, 8)]
      : [imgs.slice(0, 4)]
    const padRow = (row: string[], len: number): (string | null)[] =>
      [...row, ...Array(Math.max(0, len - row.length)).fill(null)]

    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', background: BG,
          display: 'flex', flexDirection: 'column',
          padding: '52px 56px', gap: '28px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {LOGO_B64
              ? <img src={LOGO_B64} width={180} height={36} style={{ objectFit: 'contain', opacity: 0.9 }} />
              : <div style={{ color: 'white', fontWeight: 900, fontSize: 20, display: 'flex' }}>MEMORABILIUS</div>
            }
            <div style={{ color: 'white', fontSize: 22, fontWeight: 700, display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 50, padding: '8px 20px' }}>
              Wrap {monthLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px' }}>
            <StatBox value={newCards} label="Cartes ajoutées" />
            <StatBox value={totalCards} label="Total collection" />
            <StatBox value={medals} label="Classement" />
            <StatBox value={`${rcCount} RC · ${autoCount} Auto`} label="Highlights" small />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: '10px', flex: 1 }}>
                {padRow(row, 4).map((src, ci) =>
                  src ? <CardImg key={ci} src={src} /> : <EmptyCard key={ci} />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, display: 'flex' }}>memorabilius.fr</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, display: 'flex', background: ACCENT, borderRadius: 50, padding: '8px 20px' }}>
              @{name}
            </div>
          </div>
        </div>
      ),
      { width: W, height: H, headers: { 'Content-Type': 'image/png' } }
    )
  }

  // Story 1080×1920
  const W = 1080, H = 1920
  const imgs = cardImages.slice(0, 8)
  const pairs: [string | null, string | null][] = []
  for (let i = 0; i < Math.max(2, Math.ceil(imgs.length / 2)); i++) {
    pairs.push([imgs[i * 2] || null, imgs[i * 2 + 1] || null])
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', background: BG,
        display: 'flex', flexDirection: 'column',
        padding: '70px 56px 56px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
          {LOGO_B64
            ? <img src={LOGO_B64} width={220} height={44} style={{ objectFit: 'contain', opacity: 0.9 }} />
            : <div style={{ color: 'white', fontWeight: 900, fontSize: 26, display: 'flex' }}>MEMORABILIUS</div>
          }
          <div style={{ color: 'white', fontSize: 40, fontWeight: 900, display: 'flex' }}>Wrap {monthLabel}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 22, display: 'flex' }}>@{name}</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
          {pairs.map(([a, b], ri) => (
            <div key={ri} style={{ display: 'flex', gap: '12px', flex: 1 }}>
              {a ? <CardImg src={a} /> : <EmptyCard />}
              {b ? <CardImg src={b} /> : <EmptyCard />}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '36px' }}>
          <StatBox value={newCards} label="Cartes ajoutées" />
          <StatBox value={medals} label={`/ ${totalCollectors}`} />
          {rcCount > 0 && <StatBox value={rcCount} label="RC" />}
          {autoCount > 0 && <StatBox value={autoCount} label="Auto" />}
          {patchCount > 0 && <StatBox value={patchCount} label="Patch" />}
          {numCount > 0 && <StatBox value={numCount} label="Num." />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, display: 'flex' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Content-Type': 'image/png' } }
  )
}
