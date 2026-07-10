import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLACEHOLDER = 'https://placehold.co/200x280/e0e0e0/999?text=+'

// Bannière "carte de visite" embarquable (forums, signatures, blogs) : <img src="/api/showcase/{id}">
// Publicité gratuite et virale — chaque partage ramène du trafic vers Memorabilius.
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let resolvedId = userId
  if (!uuidRegex.test(userId)) {
    const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
    if (p) resolvedId = p.id
  }

  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure').eq('id', resolvedId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', resolvedId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(4),
  ])

  if (!profile) {
    return new ImageResponse(
      (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', fontFamily: 'sans-serif', fontSize: 24, color: '#999' }}>Collector not found</div>),
      { width: 800, height: 200 }
    )
  }

  const accent = profile.couleur_bordure || '#003DA6'
  const name = profile.display_name || 'Collector'
  const thumbs = [0, 1, 2, 3].map(i => (cards || [])[i]?.image_recto || PLACEHOLDER)

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        background: `linear-gradient(135deg, ${accent} 0%, #0a0a1a 100%)`,
        fontFamily: 'sans-serif', padding: '0 32px', gap: 24,
      }}>
        {/* Avatar + nom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fff&color=003DA6&size=128`}
            width={72} height={72} style={{ borderRadius: '50%', border: '3px solid white', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 2 }}>Collection by</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{name}</div>
          </div>
        </div>

        {/* Cartes miniatures */}
        <div style={{ display: 'flex', gap: 10, flex: 1, justifyContent: 'center' }}>
          {thumbs.map((src, i) => (
            <img key={i} src={src} width={100} height={140} style={{
              borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)',
              transform: `rotate(${(i - 1.5) * 4}deg)`,
            }} />
          ))}
        </div>

        {/* Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>MEMORABILIUS</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: 800, height: 200, headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
