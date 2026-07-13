import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const alt = 'Galerie Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// import.meta.url force Next.js à tracer la dépendance → fichier bundlé dans le lambda Vercel
const logoWhiteDataUrl = (() => {
  try {
    const buf = readFileSync(new URL('../../../../public/memorabilius-logo-white.png', import.meta.url))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})()

function parseCsvImages(text: string): string[] {
  const imgs: string[] = []
  const rows = text.split(/\r?\n/).slice(4)
  for (const row of rows) {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    const img = c[0]?.trim()
    if (img?.startsWith('http')) imgs.push(img)
  }
  return imgs
}

// Retourne une data URI JPEG, rotée 90° si paysage → portrait
async function normalizeCard(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1800) })
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf).metadata()
    if (meta.width && meta.height && meta.width > meta.height) {
      const rotated = await sharp(buf).rotate(90).jpeg({ quality: 82 }).toBuffer()
      return `data:image/jpeg;base64,${rotated.toString('base64')}`
    }
    return url
  } catch {
    return url
  }
}

// LCG pseudo-random seédé → même résultat à chaque rendu pour un userId donné
function mkRand(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => { s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61); return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff }
}

interface CardSlot { url: string; x: number; y: number; w: number; h: number; rot: number; z: number }

function layoutCards(urls: string[], seed: number): CardSlot[] {
  const rand = mkRand(seed)
  const W = 1200, H = 630

  // Tailles variées
  const sizes = [
    { w: 130, h: 182 },
    { w: 155, h: 217 },
    { w: 180, h: 252 },
    { w: 110, h: 154 },
    { w: 165, h: 231 },
    { w: 145, h: 203 },
    { w: 170, h: 238 },
    { w: 120, h: 168 },
    { w: 190, h: 266 },
    { w: 140, h: 196 },
    { w: 125, h: 175 },
    { w: 160, h: 224 },
  ]

  return urls.map((url, i) => {
    const sz = sizes[i % sizes.length]
    // Répartir sur tout le canvas, avec chevauchements naturels
    const x = Math.round((rand() * (W + sz.w * 0.6)) - sz.w * 0.3)
    const y = Math.round((rand() * (H + sz.h * 0.6)) - sz.h * 0.3)
    const rot = (rand() - 0.5) * 46  // -23° à +23°
    const z = i
    return { url, x, y, w: sz.w, h: sz.h, rot, z }
  })
}

export default async function OGImage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure, lien_csv').eq('id', userId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', userId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(12),
  ])

  const accent    = profile?.couleur_bordure || '#003DA6'
  const name      = profile?.display_name    || 'Collector'
  const avatarUrl = profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=200`

  // Cartes manuelles + CSV (jusqu'à 12 images pour remplir le canvas)
  const manualImgs = (cards || []).map(c => c.image_recto).filter(Boolean) as string[]
  let csvImgs: string[] = []
  let csvCount = 0
  if (profile?.lien_csv) {
    try {
      const r = await fetch(profile.lien_csv, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const allCsv = parseCsvImages(await r.text())
        csvCount = allCsv.length
        csvImgs = allCsv.slice(0, Math.max(0, 12 - manualImgs.length))
      }
    } catch {}
  }

  const totalCount = manualImgs.length + csvCount
  const countLabel = totalCount > 0
    ? `${totalCount} carte${totalCount > 1 ? 's' : ''} dans la collection`
    : 'Collection de cartes de sport'

  // Normaliser (rotation auto si paysage) en parallèle
  const rawUrls = [...manualImgs, ...csvImgs].slice(0, 12)
  const normalizedUrls = await Promise.all(rawUrls.map(normalizeCard))

  // Seed basé sur le userId pour layout stable
  const seed = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const slots = layoutCards(normalizedUrls, seed)

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: 'linear-gradient(150deg, #04091a 0%, #0b1840 50%, #060d22 100%)',
        display: 'flex',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* Cartes éparpillées en arrière-plan */}
        {slots.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: s.x, top: s.y,
            width: s.w, height: s.h,
            transform: `rotate(${s.rot}deg)`,
            borderRadius: 8,
            overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.12)',
            zIndex: s.z,
            display: 'flex',
            opacity: 0.82,
          }}>
            <img src={s.url}
              style={{ width: s.w, height: s.h, objectFit: 'cover', objectPosition: 'center 15%', display: 'block', flexShrink: 0 }} />
          </div>
        ))}

        {/* Voile sombre pour lisibilité du texte */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'linear-gradient(to right, rgba(4,9,26,0.92) 0%, rgba(4,9,26,0.6) 45%, rgba(4,9,26,0.2) 75%, transparent 100%)',
          display: 'flex',
        }} />

        {/* Contenu texte en premier plan */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '40px 52px',
        }}>
          {/* Logo */}
          {logoWhiteDataUrl ? (
            <img src={logoWhiteDataUrl} width={200} height={40}
              style={{ width: 200, height: 40, objectFit: 'contain', display: 'block', opacity: 1 }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 5, color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
              MEMORABILIUS
            </div>
          )}

          {/* Identité + CTA */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <img src={avatarUrl} width={80} height={80}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, display: 'block', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: -1, display: 'flex' }}>
                  {name}
                </div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, display: 'flex' }}>
                  {countLabel}
                </div>
              </div>
            </div>

            <div style={{
              background: accent, borderRadius: 12, padding: '14px 30px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex' }}>
                Voir la collection
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex' }}>
                memorabilius.fr
              </div>
            </div>
          </div>
        </div>

      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
