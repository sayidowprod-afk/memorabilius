import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(
      `https://detect.roboflow.com/memorabilius-card-detector/1?api_key=${apiKey}&confidence=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: imageBase64,
      }
    )

    const responseText = await res.text()
    console.log('[detect-card] Roboflow status:', res.status, 'body:', responseText.slice(0, 300))
    if (!res.ok) return NextResponse.json({ error: 'roboflow error' }, { status: 500 })

    const data = JSON.parse(responseText)
    const preds = data.predictions ?? []
    if (preds.length === 0) return NextResponse.json({ error: 'aucune carte' }, { status: 404 })

    const best = preds.reduce((a: any, b: any) => (b.width * b.height > a.width * a.height ? b : a))
    const { x, y, width, height } = best

    return NextResponse.json({
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
      confidence: best.confidence,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
