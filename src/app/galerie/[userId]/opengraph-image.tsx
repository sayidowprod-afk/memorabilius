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

// Logo 320×71 hardcodé en base64 — pas de dépendance filesystem sur Vercel
const LOGO_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAABHCAMAAABBPG6UAAAASFBMVEX///////////////////////////9MaXH+/v7////////////////////////////////////////////////////////////xg/UrAAAAF3RSTlP+FOeiAvWhAPz7BjFWDIbadcYmQWawmm9OClAAAAAJcEhZcwAAA+gAAAPoAbV7UmsAAAj7SURBVHja7ZzbtqMgDEBti1VRa73//59OAIEEwaq1M1NXOQ9nKQ2EbbgGiKJfeC+M4xilv7ArSHjjL7wVIvirhvsv7AhDJfFl4y1hyS9sDiy5jekEkF9sKBNmAong5Mn/loeFGeNJUjrSZZJw55dIRMQxIcfKWRwTcqVfTuZeBnS0KtK3nCCg4kIJ5mrPEcBLddUhflh7ZEkXm4hrnjT2Z+htbh/iDgs/rHDVgBJJ27sJVIOMKK6eUD0uMjWInsnVIo4lz9gjVz/FZ0G5Q+aFeYgLrSJHb68tKkb8dMWZ+HO0qC4YYKx7E2gROTLSHn6iIwBV7HQ68AQ5R/ptOtbIxHmthaMxbkCnLpr1WdEIqkNJPJ0ZDBDg64jCPuaxoKZI8QHae5r1+gJxwxQnMy+sKghgp8XF2zybssnGB8TdrbjU4tITLUA5F6AJrc6BJc3VvE8ngO4oqJU566e4scK5/bF4L6Sz2SgqG+FLivJ5RljZWJeymOlMLs3GHizw4UlRxN0UQJt5oR9SB6BWsLDFMAC1uAB4qceM5DUHOKEV4oZBZwxwlQXCrzsr/EDWKwD2PnOR+XktEMQySC4pK2+kIOG3QBjXglaHWqC15wULtBXAV4NdgFE2BQdgb+t/TQEKa7bCKN2aVOEUxcnkWhuH5YTaGCDIReSjHAkQIiPdxqWq3FEYoKrzgt/lipRfY4Hyu+ganOI0GwHCPo847uJaoI2rSloLsAXWbhsYEfCHAjS1yXAMWiA8PzXAwupOAYL2RafCBQO0+kEPiQuuAJq8H8V99AKEohddj3q0i00Hnp5FjzosBDAah6KrSWd2KEBdm+Dp9lQFL8oAQFMN1UDRC1DloU0twsKD1q8OAUxlK6tLSwGKr2dbPQpQtnqmUrgAIa5B3/dYgDrXCImTgTQGCAYiu1Jag12AQ8JVYI4FQqVTHThJkgJ8JqVpXucAObPfm1og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'

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
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf).metadata()
    if (meta.width && meta.height && meta.width > meta.height) {
      const rotated = await sharp(buf).rotate(90).jpeg({ quality: 78 }).toBuffer()
      return `data:image/jpeg;base64,${rotated.toString('base64')}`
    }
    return url
  } catch {
    return url
  }
}

// ── Layout : panneau gauche solide (texte propre) + grille 3×2 à droite ──
// Panneau gauche : 0→420px, #04091a opaque — texte toujours lisible
// Section cartes : 420→1200px (780px), grille 3 colonnes × 2 rangées
const LEFT_W = 420         // largeur du panneau texte
const CARD_COLS = 3
const CARD_ROWS = 2
const TW = 260             // 3 × 260 = 780 = 1200 - 420
const TH = 315             // 2 × 315 = 630 — cartes plus hautes, moins de recadrage

interface Tile { url: string; x: number; y: number; w: number; h: number }

function buildTiles(urls: string[]): Tile[] {
  const tiles: Tile[] = []
  const n = urls.length
  let idx = 0
  for (let r = 0; r < CARD_ROWS; r++) {
    for (let c = 0; c < CARD_COLS; c++) {
      tiles.push({
        url: urls[idx % n],
        x: c * TW,
        y: r * TH,
        w: TW,
        h: TH,
      })
      idx++
    }
  }
  return tiles
}

export default async function OGImage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url, couleur_bordure, lien_csv').eq('id', userId).single(),
    supabase.from('cartes_manuelles').select('image_recto').eq('user_id', userId).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(45),
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
        const all = parseCsvImages(await r.text())
        csvCount = all.length
        csvImgs = all.slice(0, Math.max(0, 45 - manualImgs.length))
      }
    } catch {}
  }

  const totalCount = manualImgs.length + csvCount
  const countLabel = totalCount > 0
    ? `${totalCount} carte${totalCount > 1 ? 's' : ''} dans la collection`
    : 'Collection de cartes de sport'

  // 6 tuiles suffisent pour la grille 3×2
  const rawUrls = [...manualImgs, ...csvImgs].slice(0, 6)
  if (rawUrls.length === 0) rawUrls.push('https://placehold.co/260x210/0d1a3e/1e3a7a?text=+')
  const normalizedUrls = await Promise.all(rawUrls.map(normalizeCard))

  const tiles = buildTiles(normalizedUrls)

  return new ImageResponse(
    (
      // Satori : position:absolute imbriqués mal supportés → layout flex pur pour le split gauche/droite
      <div style={{
        width: 1200, height: 630,
        display: 'flex', flexDirection: 'row',
        overflow: 'hidden',
        background: '#04091a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}>

        {/* ── Panneau gauche solide (420px) — texte sur fond opaque ── */}
        <div style={{
          width: LEFT_W, height: 630, flexShrink: 0,
          background: '#04091a',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '42px 44px 44px',
        }}>
          {/* Logo */}
          <img src={LOGO_DATA_URL}
            style={{ width: 200, height: 44, objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />

          {/* Nom + compteur */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              fontSize: 46, fontWeight: 900, color: '#ffffff',
              lineHeight: 1.1, letterSpacing: -1,
              display: 'flex', flexWrap: 'wrap',
            }}>
              {name}
            </div>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.52)', display: 'flex' }}>
              {countLabel}
            </div>
          </div>

          {/* Avatar + URL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={avatarUrl}
              style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, display: 'block', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)', display: 'flex' }}>
                Voir la collection →
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.36)', display: 'flex' }}>
                memorabilius.fr
              </div>
            </div>
          </div>
        </div>

        {/* ── Section droite : cartes + fondu gauche (position:relative = contexte pour les enfants absolute) ── */}
        <div style={{
          position: 'relative',
          flex: 1, height: 630,
          overflow: 'hidden', display: 'flex',
        }}>
          {/* Tuiles de cartes (rendues en premier = sous le fondu) */}
          {tiles.map((t, i) => (
            <div key={i} style={{
              position: 'absolute', left: t.x, top: t.y,
              width: t.w, height: t.h,
              overflow: 'hidden', display: 'flex',
            }}>
              <img src={t.url}
                style={{ width: t.w, height: t.h, objectFit: 'cover', objectPosition: 'center 12%', display: 'block', flexShrink: 0 }} />
            </div>
          ))}

          {/* Fondu gauche 30px — raccord panneau/cartes, minimal pour ne pas trop couper */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            width: 30, height: 630,
            background: 'linear-gradient(to right, #04091a, transparent)',
            display: 'flex',
          }} />
        </div>

      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
