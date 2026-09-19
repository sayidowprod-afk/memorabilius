'use client'
import { useEffect, useRef } from 'react'
import { loadUprightImage } from '@/lib/uprightImage'

interface Props {
  url: string; cropX: number; cropY: number; cropW: number; cropH: number; rotationDeg: number
  style?: React.CSSProperties
}

// Rendu de la signature cadrée d'une carte quiz autographes, réutilisé par la
// manche "autograph" du quiz en direct (spectateur + overlay) -- même calcul
// que /admin/autograph-quiz/presenter/page.tsx (crop_x/y/w/h en fractions de
// l'image "upright", voir uprightImage.ts pour la remise à l'endroit des
// cartes horizontales stockées en orientation brute).
export default function SignatureCrop({ url, cropX, cropY, cropW, cropH, rotationDeg, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    loadUprightImage(url, rotationDeg).then(upright => {
      if (cancelled) return
      const sx = cropX * upright.width
      const sy = cropY * upright.height
      const sw = cropW * upright.width
      const sh = cropH * upright.height
      const outW = 900
      const outH = Math.max(1, Math.round(outW * (sh / sw)))
      canvas.width = outW
      canvas.height = outH
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(upright, sx, sy, sw, sh, 0, 0, outW, outH)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [url, cropX, cropY, cropW, cropH, rotationDeg])

  return <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, background: '#111', ...style }} />
}
