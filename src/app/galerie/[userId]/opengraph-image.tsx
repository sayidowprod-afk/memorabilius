import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const alt = 'Galerie Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Logo mémorisé en base64 (320×71 px, 2.5 KB) — pas de dépendance filesystem sur Vercel
const LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAUAAAABHCAMAAABBPG6UAAAASFBMVEX///////////////////////////9MaXH+/v7////////////////////////////////////////////////////////////xg/UrAAAAF3RSTlP+FOeiAvWhAPz7BjFWDIbadcYmQWawmm9OClAAAAAJcEhZcwAAA+gAAAPoAbV7UmsAAAj7SURBVHja7ZzbtqMgDEBti1VRa73//59OAIEEwaq1M1NXOQ9nKQ2EbbgGiKJfeC+M4xilv7ArSHjjL7wVIvirhvsv7AhDJfFl4y1hyS9sDiy5jekEkF9sKBNmAong5Mn/loeFGeNJUjrSZZJw55dIRMQxIcfKWRwTcqVfTuZeBnS0KtK3nCCg4kIJ5mrPEcBLddUhflh7ZEkXm4hrnjT2Z+htbh/iDgs/rHDVgBJJ27sJVIOMKK6eUD0uMjWInsnVIo4lz9gjVz/FZ0G5Q+aFeYgLrSJHb68tKkb8dMWZ+HO0qC4YYKx7E2gROTLSHn6iIwBV7HQ68AQ5R/ptOtbIxHmthaMxbkCnLpr1WdEIqkNJPJ0ZDBDg64jCPuaxoKZI8QHae5r1+gJxwxQnMy+sKghgp8XF2zybssnGB8TdrbjU4tITLUA5F6AJrc6BJc3VvE8ngO4oqJU566e4scK5/bF4L6Sz2SgqG+FLivJ5RljZWJeymOlMLs3GHizw4UlRxN0UQJt5oR9SB6BWsLDFMAC1uAB4qceM5DUHOKEV4oZBZwxwlQXCrzsr/EDWKwD2PnOR+XktEMQySC4pK2+kIOG3QBjXglaHWqC15wULtBXAV4NdgFE2BQdgb+t/TQEKa7bCKN2aVOEUxcnkWhuH5YTaGCDIReSjHAkQIiPdxqWq3FEYoKrzgt/lipRfY4Hyu+ganOI0GwHCPo847uJaoI2rSloLsAXWbhsYEfCHAjS1yXAMWiA8PzXAwupOAYL2RafCBQO0+kEPiQuuAJq8H8V99AKEohddj3q0i00Hnp5FjzosBDAah6KrSWd2KEBdm+Dp9lQFL8oAQFMN1UDRC1DloU0twsKD1q8OAUxlK6tLSwGKr2dbPQpQtnqmUrgAIa5B3/dYgDrXCImTgTQGCAYiu1Jag12AQ8JVYI4FQqVTHThJkgJ8JqVpXucAObPfm1ogjHh4FQTIMNxjAeoiyuJxU3I/QN2VMtoyrbNAOa5hTgfuAcgXALIFgMkCwORzAFubMPNO5RyAvWJwRwxWArSjoH4/wGQnwPLjAHUFWwaou9JLtd0Cp5kMrcEnAigosJcAZSYMD8C2AExzIdxR+F8OMMe6vwSoulIGGqTbAU6tGKnB3w8Qta79CoCqpjtTqLUAhfJOB/79AJG214udrAYBSlVbd3awDqCa9xYO/G8H2HnkwwDlUBetBWwCOMoVgJtT/b8doCkjmiksABQLCrzeZ4GymaA1+AQAOZoc8WQFwLTJ7dx/G0DRTMyq/5cD5KZHhbLqgcwCQFENn7QGrwco5qyz6v/1AAs7I3+uAAh1uJ6tXK0FGI19dToLRAsV/QqAYn1y5mlYCxCiI1f2ywEyvKClBzLLAKNoGeCwBDB6CyD//xYTGHJQTMslrwCO0RsWOPeTfflqDJ7Ypnq55AXA8ZUFGvfysQAfrGxjvPixEmDHy+5jK9LMXcldABhFfkMkACHVago59YmMft/GWoDQwlRVbHEOyTqAI5ZT3rxjATKkcNZMDv8VAKONTiW/8HqAjuMG/MJrAZLvNRzuWGfYtdCFAUKliQmDOOTWVG5q4YY3AF3hLN4BcNqzqIZDYocBXdIvQwCx3MA/ADAfnYFMAOCtJu4R5CF7aYEwT6yIewQ5jrZYIHLJMbbBAk0DCJuDDt/agV1dasHZCxAYoFkEsEa9N7VAuUUzS7EFQhc6YOHhjsuw1gIhWVODG2qBVV3XccgC1YZRZbnl8XtjkI/S+H38AHMyKXsGAPosEADibQRjO+wAiBozuUsoceeUrx3rQJCz4wGi2ZwcxAUA3o3HVpbNb4F+xzoA5FfUn0IGWwGCzXfWsZ4JFzUCqPclex3rnXWsH761gxE3z7QJLQDwZsfcorX0A/QPpMXbmxUezHaibQNpO+SiA+klC5QDadQYHz8OTMj2BLVlMAAwxw7iEMBh2j3KHICF9V+1OwFyvDOhJBaY2R1EvplI/EmAZDbXhQHezVKq3KKw1QLNJghR9p0WGNja8dICPw0QleC2BFBDS9UGsm0AtTdeegWOBQh9wzAM8cJc+MMAadOyAFARke7h7QCLafMajG8OB/hqMeGjAPF2STmQCQNUm5sV5s0A1WeCEQjjHwAYmon8HYBPMpAJt4GKWipnlFsBTt4DDelcFmj2iMoMFgAKJLIb3QOwkMd35Dr4uQASxeSxgwBAJrc3q61wOwCKPUmyBKcDSGZzxQJAOf+UC69sM0C1p0au+JwQYGcbwfsCQCYSk/7PXQBbEBGbXE8IMCdr5eEqLGYtcr63A6Asv1wxO18bKNo2s+qRLwAUHbb0L+4BKOqw1PJ8ANGWP1GIJYB5Oq3D7gHYqhXHMwIs8ELLUhVO6jrZW4XBwS3XvM8IsLniZekwQAD3nP5vBwiG3p0TYOJsUFiywKbZb4FJc0lOWYUlj2wdwNmRyy0AtYInBNiuq8KvAfpOKm0AWP5LgPqo0QLA0gFoRFq86+SfWaAQ3n5W7iXAg5b01SwDfWBsgXocI7PfDzDkVFoFEJ4e3RAdDBA7lRYBDp05bekHKPV7oCc45jCd0Hz26WgXpd8AGHJrvgD4+rzwXoCrzwuT41gEYBOPAf1yU3Hx6+49gPrEeroaID2xnvlPrO8HmJLT7I8wwOnEuUiaACypfuTQdzvGU3Hxeeu/bIGr7kx4ywLpOZetFji7FgHtEGvdDePSe+i7tSObA8xW39rhA7jx1g4NMJ3ylACNBgpgqq/04Dtu7bCXkCiA9tYOUUV8+sHCEgAkMWDrPQ+vSH/IAqHTS1/eG3OEBS7eGxO2QHEPj0e/WMS07qmDoXSW9CvfxUXSjxJvuLkoflLhIaY3F+W30M1FMUoCnFr2FqISXZ4UtzguBiPYcXOR/Rn0XRm6uUjod5/pd5erojkRr++zzUW8NIEzHEgMfvC/xVdnUWF1B9YsBT7dnUWTQD9grm6hOPya8TWaz5IO6se49yUC+Lu97Y3b28T9gTcU6B15NOI2D+TtfUn47klg/sulTFcppBPdpfmKxMzLm7o/0G6N/YWtwdyh+gu775+FXeS/8Fb4A/IOxLGczRdvAAAAAElFTkSuQmCC'
const LOGO_DATA_URL = `data:image/png;base64,${LOGO_B64}`

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

async function normalizeCard(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1800) })
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf).metadata()
    if (meta.width && meta.height && meta.width > meta.height) {
      const rotated = await sharp(buf).rotate(90).jpeg({ quality: 80 }).toBuffer()
      return `data:image/jpeg;base64,${rotated.toString('base64')}`
    }
    return url
  } catch {
    return url
  }
}

// LCG pseudo-random seedé → layout stable par userId
function mkRand(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1)
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff
  }
}

interface Slot { url: string; x: number; y: number; w: number; h: number; rot: number; z: number }

function layoutCards(urls: string[], seed: number): Slot[] {
  const rand = mkRand(seed)
  const W = 1200, H = 630
  // Grille de cellules pour couvrir tout le canvas, puis dispersion aléatoire dans chaque cellule
  const COLS = 6, ROWS = 5
  const CW = W / COLS, CH = H / ROWS
  const sizes = [
    { w: 120, h: 168 }, { w: 140, h: 196 }, { w: 155, h: 217 },
    { w: 130, h: 182 }, { w: 110, h: 154 }, { w: 165, h: 231 },
    { w: 125, h: 175 }, { w: 145, h: 203 }, { w: 135, h: 189 },
    { w: 150, h: 210 }, { w: 118, h: 165 }, { w: 160, h: 224 },
  ]

  // Génère les positions couvrant toute la grille (30 cellules pour 30 cartes)
  const cells: { cx: number; cy: number }[] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      cells.push({ cx: c * CW + CW / 2, cy: r * CH + CH / 2 })

  // Mélange les cellules (Fisher-Yates avec notre rand)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]]
  }

  return urls.map((url, i) => {
    const cell = cells[i % cells.length]
    const sz = sizes[i % sizes.length]
    // Dispersion dans la cellule + débordement léger aux bords
    const jitterX = (rand() - 0.5) * CW * 0.9
    const jitterY = (rand() - 0.5) * CH * 0.9
    const x = Math.round(cell.cx + jitterX - sz.w / 2)
    const y = Math.round(cell.cy + jitterY - sz.h / 2)
    const rot = (rand() - 0.5) * 50
    return { url, x, y, w: sz.w, h: sz.h, rot, z: i }
  })
}

export default async function OGImage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure, lien_csv').eq('id', userId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', userId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(30),
  ])

  const accent    = profile?.couleur_bordure || '#003DA6'
  const name      = profile?.display_name    || 'Collector'
  const avatarUrl = profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c1942&color=ffffff&size=200`

  const manualImgs = (cards || []).map(c => c.image_recto).filter(Boolean) as string[]
  let csvImgs: string[] = []
  let csvCount = 0
  if (profile?.lien_csv) {
    try {
      const r = await fetch(profile.lien_csv, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const allCsv = parseCsvImages(await r.text())
        csvCount = allCsv.length
        csvImgs = allCsv.slice(0, Math.max(0, 30 - manualImgs.length))
      }
    } catch {}
  }

  const totalCount = manualImgs.length + csvCount
  const countLabel = totalCount > 0
    ? `${totalCount} carte${totalCount > 1 ? 's' : ''} dans la collection`
    : 'Collection de cartes de sport'

  // Jusqu'à 30 images, normalisées en parallèle (rotation auto si paysage)
  const rawUrls = [...manualImgs, ...csvImgs].slice(0, 30)
  const normalizedUrls = await Promise.all(rawUrls.map(normalizeCard))

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

        {/* Cartes éparpillées couvrant tout le canvas */}
        {slots.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: s.x, top: s.y,
            width: s.w, height: s.h,
            transform: `rotate(${s.rot}deg)`,
            borderRadius: 7, overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.13)',
            zIndex: s.z, display: 'flex', opacity: 0.78,
          }}>
            <img src={s.url}
              style={{ width: s.w, height: s.h, objectFit: 'cover', objectPosition: 'center 15%', display: 'block', flexShrink: 0 }} />
          </div>
        ))}

        {/* Voile dégradé pour lisibilité */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'linear-gradient(135deg, rgba(4,9,26,0.88) 0%, rgba(4,9,26,0.55) 40%, rgba(4,9,26,0.18) 70%, rgba(4,9,26,0.08) 100%)',
          display: 'flex',
        }} />

        {/* Premier plan : logo haut-gauche, profil bas-gauche, CTA bas-droit */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '36px 48px 40px',
        }}>
          {/* Logo */}
          <img src={LOGO_DATA_URL} width={210} height={47}
            style={{ width: 210, height: 47, objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />

          {/* Bas : profil gauche + CTA droit */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {/* Profil */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <img src={avatarUrl} width={76} height={76}
                style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, display: 'block', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: -1, display: 'flex' }}>
                  {name}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.48)', letterSpacing: 0.3, display: 'flex' }}>
                  {countLabel}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{
              background: accent, borderRadius: 12, padding: '14px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex' }}>
                Voir la collection
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
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
