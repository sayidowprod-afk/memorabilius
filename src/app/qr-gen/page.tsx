'use client'
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { saveOrShareFile } from '@/lib/saveOrShare'

const BRAND  = '#003DA6'
const QR_SIZE = 220
const SCALE   = 4
const LOGO_W  = 160
const LOGO_H  = 36

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

export default function QrGen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const phys = QR_SIZE * SCALE

    QRCode.toCanvas(canvas, 'https://memorabilius.fr', {
      width: phys,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: BRAND, light: '#ffffff' },
    }).then(() => {
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`
      const ctx = canvas.getContext('2d')!
      const cx = phys / 2, cy = phys / 2
      const lgW = LOGO_W * SCALE
      const lgH = LOGO_H * SCALE
      const pad = 3 * SCALE, bR = 8 * SCALE

      ctx.fillStyle = 'white'
      rrect(ctx, cx - lgW/2 - pad, cy - lgH/2 - pad, lgW + pad*2, lgH + pad*2, bR + pad)
      ctx.fill()

      ctx.fillStyle = BRAND
      rrect(ctx, cx - lgW/2, cy - lgH/2, lgW, lgH, bR)
      ctx.fill()

      const logo = new Image()
      logo.src = '/memorabilius-logo-qr-hd.png'
      logo.onload = () => {
        ctx.save()
        rrect(ctx, cx - lgW/2, cy - lgH/2, lgW, lgH, bR)
        ctx.clip()
        ctx.drawImage(logo, cx - lgW/2, cy - lgH/2, lgW, lgH)
        ctx.restore()

        // Auto-download
        saveOrShareFile(canvas.toDataURL('image/png'), 'memorabilius-homepage-qr.png')
      }
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <canvas ref={canvasRef} />
      <p style={{ fontSize: 13, color: '#555' }}>Génération en cours… Le téléchargement démarre automatiquement.</p>
    </div>
  )
}
