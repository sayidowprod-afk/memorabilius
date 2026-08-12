import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export async function GET() {
  const BRAND  = '#003DA6'
  const phys   = 880
  const lgW    = 640
  const lgH    = 144
  const pad    = 12
  const bR     = 32
  const cx     = phys / 2
  const cy     = phys / 2

  const qrBuf = await (QRCode as any).toBuffer('https://memorabilius.fr', {
    width: phys,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: BRAND, light: '#ffffff' },
    type: 'png',
  })

  const logoPath = resolve(process.cwd(), 'public/memorabilius-logo-qr-hd.png')
  const logoResized = await sharp(readFileSync(logoPath))
    .resize(lgW, lgH, { fit: 'fill' })
    .png()
    .toBuffer()

  const haloSvg  = `<svg width="${lgW + pad*2}" height="${lgH + pad*2}" xmlns="http://www.w3.org/2000/svg"><rect width="${lgW + pad*2}" height="${lgH + pad*2}" rx="${bR + pad}" fill="white"/></svg>`
  const badgeSvg = `<svg width="${lgW}" height="${lgH}" xmlns="http://www.w3.org/2000/svg"><rect width="${lgW}" height="${lgH}" rx="${bR}" fill="${BRAND}"/></svg>`

  const png = await sharp(qrBuf)
    .composite([
      { input: Buffer.from(haloSvg), left: Math.round(cx - lgW/2 - pad), top: Math.round(cy - lgH/2 - pad) },
      { input: Buffer.from(badgeSvg), left: Math.round(cx - lgW/2),      top: Math.round(cy - lgH/2) },
      { input: logoResized,           left: Math.round(cx - lgW/2),      top: Math.round(cy - lgH/2) },
    ])
    .png()
    .toBuffer()

  return new NextResponse(png.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="memorabilius-qr.png"',
    },
  })
}
