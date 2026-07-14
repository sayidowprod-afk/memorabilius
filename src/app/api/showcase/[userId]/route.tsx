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

const W = 900
const H = 300

// SVG placeholder inline — no external HTTP dependency
const PLACEHOLDER = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="168"><rect width="120" height="168" fill="#0d1a3e"/><text x="60" y="90" text-anchor="middle" dominant-baseline="middle" fill="#1e3a7a" font-size="40" font-family="sans-serif">+</text></svg>'
).toString('base64')

// Logo read from disk once — avoids self-referential HTTP call on Vercel
let LOGO_B64: string | null = null
try {
  const logoPath = path.join(process.cwd(), 'public', 'memorabilius-logo-white.png')
  LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
} catch {}

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let resolvedId = userId
  if (!uuidRegex.test(userId)) {
    const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
    if (p) resolvedId = p.id
  }

  const [{ data: profile }, { data: cards }, { count: cardCount }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure').eq('id', resolvedId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', resolvedId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('user_id', resolvedId),
  ])

  if (!profile) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1942', fontFamily: 'sans-serif', fontSize: 18, color: '#555' }}>
        Collector not found
      </div>,
      { width: W, height: H }
    )
  }

  const accent = profile.couleur_bordure || '#003DA6'
  const name = profile.display_name || 'Collector'
  const thumbs = Array.from({ length: 5 }, (_, i) => (cards || [])[i]?.image_recto || PLACEHOLDER)
  const avatarUrl = profile.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=128`

  const countLabel = cardCount != null
    ? `${cardCount} carte${cardCount > 1 ? 's' : ''}`
    : 'Collection'

  const CARD_W = 100
  const CARD_H = 140
  const rotations = [-10, -5, 0, 5, 10]
  const yOffsets = [14, 6, 0, 6, 14]
  const zIndexes = [1, 3, 5, 3, 1]

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(145deg, #04091a 0%, #0b1840 55%, #060d22 100%)',
        display: 'flex', flexDirection: 'row', alignItems: 'stretch',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Glow central */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Gauche : identité */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '0 28px', gap: 12, flexShrink: 0, width: 220,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', zIndex: 5,
        }}>
          {/* Logo image */}
          {LOGO_B64 && (
            <img
              src={LOGO_B64}
              width={140} height={28}
              style={{ display: 'block', objectFit: 'contain', marginBottom: 4, opacity: 0.85 }}
            />
          )}

          {/* Avatar */}
          <img
            src={avatarUrl}
            width={56} height={56}
            style={{ borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${accent}`, display: 'block' }}
          />

          {/* Nom */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: -0.5, display: 'flex' }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', background: accent, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: 'white' }}>
                {countLabel}
              </span>
              <span style={{ display: 'flex' }}>memorabilius.fr</span>
            </div>
          </div>
        </div>

        {/* Droite : cartes en éventail */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: 0, paddingTop: 10,
          position: 'relative', zIndex: 2,
        }}>
          {thumbs.map((src, i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${rotations[i]}deg) translateY(${yOffsets[i]}px)`,
                borderRadius: 7,
                overflow: 'hidden',
                border: i === 2 ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
                zIndex: zIndexes[i],
                marginLeft: i === 0 ? 0 : -18,
                display: 'flex',
              }}
            >
              <img src={src} width={CARD_W} height={CARD_H} style={{ display: 'block', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    }
  )
}
