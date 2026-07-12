import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

// SSRF guard : seuls les CDNs autorisés
const ALLOWED = [
  'https://a.espncdn.com/i/teamlogos/',
]

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !ALLOWED.some(prefix => url.startsWith(prefix))) {
    return new NextResponse('invalid url', { status: 400 })
  }

  try {
    const upstream = await fetch(url, { next: { revalidate: 604800 } })
    if (!upstream.ok) return new NextResponse('upstream error', { status: 502 })

    const buf = Buffer.from(await upstream.arrayBuffer())

    // Supprime le fond blanc via la formule feColorMatrix :
    // alpha = clamp(-R -G -B + 3)  →  blanc→0, couleurs/noir→1
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const px = new Uint8Array(data.buffer)
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
      px[i + 3] = Math.round(Math.max(0, Math.min(1, -r - g - b + 3)) * 255)
    }

    const out = await sharp(Buffer.from(px.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png({ compressionLevel: 7 }).toBuffer()

    return new NextResponse(out, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('processing error', { status: 500 })
  }
}
