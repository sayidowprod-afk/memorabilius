import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isSafeExternalUrl } from '@/lib/safeUrl'

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

async function fetchAsB64(url: string): Promise<string | null> {
  // card_key est un champ libre (cartes CSV) — sans ce garde-fou, une URL
  // interne/privée pourrait être fetchée par le serveur puis renvoyée en pixels (SSRF).
  if (!isSafeExternalUrl(url)) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const ct = r.headers.get('content-type') || 'image/jpeg'
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch { return null }
}

// Dispose jusqu'à 5 cartes en grille adaptative (3 en haut + 2 centrées en
// bas pour 4-5, une seule ligne sinon).
function layoutRows(n: number): number[] {
  if (n <= 3) return [n]
  if (n === 4) return [2, 2]
  return [3, 2]
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return new Response('userId manquant', { status: 400 })

  const [{ data: profile }, { data: grail }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure, stats_total').eq('id', userId).single(),
    supabase.from('grail_cards').select('card_key').eq('user_id', userId).order('position').limit(5),
  ])

  if (!grail || grail.length === 0) return new Response('Aucune pièce dans le Grail Wall', { status: 404 })

  const accent = profile?.couleur_bordure || '#003DA6'
  const name = profile?.display_name || 'Collector'
  const b64Images = await Promise.all(grail.map((g: any) => fetchAsB64(g.card_key)))
  const cardUrls = b64Images.filter(Boolean) as string[]
  if (cardUrls.length === 0) return new Response('Images indisponibles', { status: 404 })

  const rows = layoutRows(cardUrls.length)
  let idx = 0
  const rowsOfUrls = rows.map(count => cardUrls.slice(idx, (idx += count)))

  const BG = '#060d22'

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', background: BG,
        display: 'flex', flexDirection: 'column',
        padding: '48px 48px 40px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          {LOGO_B64
            ? <img src={LOGO_B64} width={170} height={34} style={{ objectFit: 'contain', opacity: 0.9 }} />
            : <div style={{ color: 'white', fontWeight: 900, fontSize: 18, display: 'flex' }}>MEMORABILIUS</div>
          }
          <div style={{ color: 'white', fontSize: 18, fontWeight: 800, display: 'flex', background: accent, borderRadius: 50, padding: '7px 20px' }}>
            💎 TOP {cardUrls.length}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
          {rowsOfUrls.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              {row.map((src, ci) => (
                <div key={ci} style={{
                  width: 280, aspectRatio: '2.5 / 3.5', display: 'flex',
                  background: '#0d1a30', borderRadius: 14, overflow: 'hidden',
                  border: `2px solid ${accent}`,
                }}>
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=200`}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, display: 'block' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ color: 'white', fontWeight: 900, fontSize: 20, display: 'flex' }}>{name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, display: 'flex' }}>
                {profile?.stats_total ? `${profile.stats_total} cartes au total` : 'memorabilius.fr'}
              </div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, display: 'flex' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { 'Content-Type': 'image/png' } }
  )
}
