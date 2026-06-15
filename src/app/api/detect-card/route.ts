import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(
      `https://detect.roboflow.com/memd/1?api_key=${apiKey}&confidence=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: imageBase64,
      }
    )

    const responseText = await res.text()
    console.log('[detect-card] Roboflow status:', res.status, 'body:', responseText.slice(0, 500))

    if (!res.ok) return NextResponse.json({ error: 'roboflow error', detail: responseText }, { status: 500 })

    const data = JSON.parse(responseText)
    const preds = data.predictions ?? []
    console.log('[detect-card] predictions count:', preds.length)
    if (preds.length === 0) return NextResponse.json({ error: 'aucune carte détectée' }, { status: 404 })

    // Prend la prédiction avec le plus grand bbox
    const best = preds.reduce((a: any, b: any) => (b.width * b.height > a.width * a.height ? b : a))
    const keypoints: any[] = best.keypoints ?? []
    console.log('[detect-card] keypoints:', JSON.stringify(keypoints))

    if (keypoints.length < 4) return NextResponse.json({ error: 'keypoints insuffisants' }, { status: 500 })

    // Mappe les keypoints par nom
    const find = (name: string) => keypoints.find((k: any) => k.name === name)
    const tl = find('top-left')
    const tr = find('top-right')
    const br = find('bottom-right')
    const bl = find('bottom-left')

    if (!tl || !tr || !br || !bl) {
      // Fallback : ordre d'index si les noms ne matchent pas
      return NextResponse.json({
        corners: {
          topLeft:     { x: keypoints[0].x, y: keypoints[0].y },
          topRight:    { x: keypoints[1].x, y: keypoints[1].y },
          bottomRight: { x: keypoints[2].x, y: keypoints[2].y },
          bottomLeft:  { x: keypoints[3].x, y: keypoints[3].y },
        }
      })
    }

    return NextResponse.json({
      corners: {
        topLeft:     { x: tl.x, y: tl.y },
        topRight:    { x: tr.x, y: tr.y },
        bottomRight: { x: br.x, y: br.y },
        bottomLeft:  { x: bl.x, y: bl.y },
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
