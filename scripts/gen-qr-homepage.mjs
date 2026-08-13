import QRCode from '../node_modules/qrcode/lib/index.js'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// Exactement les constantes de ShareButton.tsx
const BRAND  = '#003DA6'
const QR_SIZE = 220
const SCALE   = 4
const LOGO_W  = 160
const LOGO_H  = 36
const phys    = QR_SIZE * SCALE  // 880px
const lgW     = LOGO_W  * SCALE  // 640px
const lgH     = LOGO_H  * SCALE  // 144px
const pad     = 3 * SCALE
const bR      = 8 * SCALE
const cx      = phys / 2
const cy      = phys / 2

// Version 10 forcée (57×57 modules) pour avoir la même densité que les QR de cartes.
// L'URL courte remplirait v2 (~25 modules), trop peu de modules pour absorber le logo.
const qrBuf = await QRCode.toBuffer('https://www.memorabilius.fr', {
  width: phys,
  margin: 2,
  version: 10,
  errorCorrectionLevel: 'H',
  color: { dark: BRAND, light: '#ffffff' },
  type: 'png',
})

const logoResized = await sharp(readFileSync(resolve(__dir, '../public/memorabilius-logo-qr-hd.png')))
  .resize(lgW, lgH, { fit: 'fill' })
  .png()
  .toBuffer()

const haloSvg  = `<svg width="${lgW+pad*2}" height="${lgH+pad*2}" xmlns="http://www.w3.org/2000/svg"><rect width="${lgW+pad*2}" height="${lgH+pad*2}" rx="${bR+pad}" fill="white"/></svg>`
const badgeSvg = `<svg width="${lgW}" height="${lgH}" xmlns="http://www.w3.org/2000/svg"><rect width="${lgW}" height="${lgH}" rx="${bR}" fill="${BRAND}"/></svg>`

const out = resolve(__dir, 'memorabilius-homepage-qr.png')
const info = await sharp(qrBuf)
  .composite([
    { input: Buffer.from(haloSvg), left: cx - lgW/2 - pad | 0, top: cy - lgH/2 - pad | 0 },
    { input: Buffer.from(badgeSvg), left: cx - lgW/2 | 0,      top: cy - lgH/2 | 0 },
    { input: logoResized,           left: cx - lgW/2 | 0,      top: cy - lgH/2 | 0 },
  ])
  .png()
  .toFile(out)

console.log(`✓ ${out}  (${info.width}×${info.height} px)`)
