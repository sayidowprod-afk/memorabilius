import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const alt = 'Galerie Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLACEHOLDER = 'https://placehold.co/200x280/0d1a3e/1e3a7a?text=+'

const logoWhiteDataUrl = (() => {
  try {
    const buf = readFileSync(join(process.cwd(), 'public/memorabilius-logo-white.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})()

const CARD_W = 200
const CARD_H = 280
const rotations = [-12, -6, 0, 6, 12]
const yOffsets  = [24,  10,  0, 10, 24]
const zIndexes  = [1,   3,  5, 3,  1]

// Retourne une data URI JPEG de l'image, auto-rotée si paysage → portrait
async function normalizeCard(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf).metadata()
    if (meta.width && meta.height && meta.width > meta.height) {
      const rotated = await sharp(buf).rotate(90).jpeg({ quality: 85 }).toBuffer()
      return `data:image/jpeg;base64,${rotated.toString('base64')}`
    }
    return url
  } catch {
    return url
  }
}

// Parse simplifié du CSV TCDB/collecteur pour extraire les URLs d'images
function parseCsvImages(text: string): string[] {
  const imgs: string[] = []
  const rows = text.split(/\r?\n/).slice(4)
  for (const row of rows) {
    if (imgs.length >= 10) break
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    const img = c[0]?.trim()
    if (img?.startsWith('http')) imgs.push(img)
  }
  return imgs
}

export default async function OGImage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const [{ data: profile }, { data: cards }, { count: cardCount }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure, lien_csv').eq('id', userId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', userId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const accent     = profile?.couleur_bordure || '#003DA6'
  const name       = profile?.display_name    || 'Collector'
  const avatarUrl  = profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=200`
  const countLabel = cardCount != null
    ? `${cardCount} carte${cardCount > 1 ? 's' : ''} dans la collection`
    : 'Collection de cartes de sport'

  // Fusion cartes manuelles + CSV jusqu'à 5 images
  const manualImgs = (cards || []).map(c => c.image_recto).filter(Boolean) as string[]
  const csvImgs: string[] = []
  if (manualImgs.length < 5 && profile?.lien_csv) {
    try {
      const r = await fetch(profile.lien_csv, { signal: AbortSignal.timeout(3000) })
      if (r.ok) csvImgs.push(...parseCsvImages(await r.text()))
    } catch {}
  }
  const rawThumbs = Array.from({ length: 5 }, (_, i) => {
    return manualImgs[i] || csvImgs[i - manualImgs.length] || PLACEHOLDER
  })

  // Normaliser en parallèle (rotation auto si paysage)
  const thumbs = await Promise.all(rawThumbs.map(url =>
    url === PLACEHOLDER ? Promise.resolve(PLACEHOLDER) : normalizeCard(url)
  ))

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: 'linear-gradient(150deg, #04091a 0%, #0b1840 50%, #060d22 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* Glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 68% 52% at 50% 44%, rgba(255,255,255,0.05) 0%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Top strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 52px 0', position: 'relative', zIndex: 10,
        }}>
          {logoWhiteDataUrl ? (
            <img src={logoWhiteDataUrl} width={180} height={36}
              style={{ width: 180, height: 36, objectFit: 'contain', display: 'block', opacity: 0.95 }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: accent, display: 'flex' }} />
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 5, color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
                MEMORABILIUS
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: 2, display: 'flex' }}>
            memorabilius.fr
          </div>
        </div>

        {/* Cards fan — hero */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
            {thumbs.map((src, i) => (
              <div key={i} style={{
                width: CARD_W, height: CARD_H,
                flexShrink: 0,
                transform: `rotate(${rotations[i]}deg) translateY(${yOffsets[i]}px)`,
                borderRadius: 10,
                overflow: 'hidden',
                border: i === 2 ? `2.5px solid ${accent}` : '1.5px solid rgba(255,255,255,0.1)',
                zIndex: zIndexes[i],
                marginLeft: i === 0 ? 0 : -28,
                display: 'flex',
              }}>
                <img src={src}
                  style={{ width: CARD_W, height: CARD_H, objectFit: 'cover', objectPosition: 'center 15%', display: 'block', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 52px 32px', position: 'relative', zIndex: 10,
        }}>
          <div style={{ position: 'absolute', top: 0, left: 52, right: 52, height: 1, background: 'rgba(255,255,255,0.07)', display: 'flex' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src={avatarUrl} width={68} height={68}
              style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, display: 'block', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: -1, display: 'flex' }}>
                {name}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', letterSpacing: 0.3, display: 'flex' }}>
                {countLabel}
              </div>
            </div>
          </div>

          <div style={{
            background: accent, borderRadius: 10, padding: '12px 26px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase', display: 'flex' }}>
              Voir la collection
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', display: 'flex' }}>
              memorabilius.fr
            </div>
          </div>
        </div>

      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
