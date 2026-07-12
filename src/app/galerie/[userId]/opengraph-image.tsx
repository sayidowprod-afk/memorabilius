import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const alt = 'Galerie Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLACEHOLDER = 'https://placehold.co/164x230/0d1a3e/1e3a7a?text=+'

export default async function OGImage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const [{ data: profile }, { data: cards }, { count: cardCount }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure').eq('id', userId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', userId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const accent = profile?.couleur_bordure || '#003DA6'
  const name = profile?.display_name || 'Collector'
  const thumbs = Array.from({ length: 5 }, (_, i) => (cards || [])[i]?.image_recto || PLACEHOLDER)
  const avatarUrl = profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=200`

  const CARD_W = 162
  const CARD_H = 227
  const rotations = [-13, -6.5, 0, 6.5, 13]
  const yOffsets = [24, 10, 0, 10, 24]
  const zIndexes = [1, 3, 5, 3, 1]

  const countLabel = cardCount != null
    ? `${cardCount} carte${cardCount > 1 ? 's' : ''} dans la collection`
    : 'Collection de cartes de sport'

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(150deg, #04091a 0%, #0b1840 50%, #060d22 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* Spotlight behind cards — subtle white radial */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 68% 52% at 50% 44%, rgba(255,255,255,0.055) 0%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Top strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '30px 56px 0',
          position: 'relative', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              background: accent, display: 'flex',
            }} />
            <div style={{
              fontSize: 12, fontWeight: 900, letterSpacing: 5,
              color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
              display: 'flex',
            }}>
              MEMORABILIUS
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, display: 'flex' }}>
            memorabilius.fr
          </div>
        </div>

        {/* Cards — main hero, fan formation */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingTop: 8, paddingBottom: 0,
          position: 'relative', zIndex: 2,
        }}>
          {thumbs.map((src, i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${rotations[i]}deg) translateY(${yOffsets[i]}px)`,
                borderRadius: 10,
                overflow: 'hidden',
                border: i === 2
                  ? `2.5px solid ${accent}`
                  : '1.5px solid rgba(255,255,255,0.09)',
                flexShrink: 0,
                zIndex: zIndexes[i],
                marginLeft: i === 0 ? 0 : -26,
                display: 'flex',
              }}
            >
              <img
                src={src}
                width={CARD_W}
                height={CARD_H}
                style={{ display: 'block', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>

        {/* Bottom info bar — strictly below cards, no overlap */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 56px 34px',
          paddingTop: 22,
          position: 'relative', zIndex: 10,
        }}>
          {/* Hairline separator */}
          <div style={{
            position: 'absolute', top: 0, left: 56, right: 56, height: 1,
            background: 'rgba(255,255,255,0.07)', display: 'flex',
          }} />

          {/* Collector identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <img
              src={avatarUrl}
              width={70} height={70}
              style={{
                borderRadius: '50%', objectFit: 'cover',
                border: `3px solid ${accent}`,
                display: 'block',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{
                fontSize: 35, fontWeight: 900, color: '#ffffff',
                lineHeight: 1, letterSpacing: -1, display: 'flex',
              }}>
                {name}
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.38)',
                letterSpacing: 0.3, display: 'flex',
              }}>
                {countLabel}
              </div>
            </div>
          </div>

          {/* CTA button */}
          <div style={{
            background: accent,
            borderRadius: 10,
            padding: '13px 28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: '#ffffff',
              letterSpacing: 1.2, textTransform: 'uppercase', display: 'flex',
            }}>
              Voir la collection
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, display: 'flex' }}>
              memorabilius.fr
            </div>
          </div>
        </div>

      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    }
  )
}
