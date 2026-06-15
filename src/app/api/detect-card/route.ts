import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Locate the sports/trading card in this image and return the 4 corner positions as fractions of the image size (values between 0.0 and 1.0, where 0,0 is top-left and 1,1 is bottom-right).

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "topLeft": {"x": 0.12, "y": 0.08},
  "topRight": {"x": 0.88, "y": 0.08},
  "bottomRight": {"x": 0.88, "y": 0.95},
  "bottomLeft": {"x": 0.12, "y": 0.95}
}

Rules:
- x is horizontal position (0=left edge, 1=right edge), y is vertical (0=top, 1=bottom)
- Find the actual card corners precisely, even if the card is tilted or rotated
- If multiple cards are visible, pick the largest/most prominent one
- If no card is visible, return {"error": "no card found"}`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg', width: imgWidth, height: imgHeight } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
      })
    })

    const responseText = await res.text()
    console.log('[detect-card] Gemini status:', res.status, 'body:', responseText.slice(0, 500))

    if (!res.ok) return NextResponse.json({ error: 'gemini error', detail: responseText }, { status: 500 })

    const data = JSON.parse(responseText)
    const raw = data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '').join('') ?? ''

    console.log('[detect-card] Gemini raw:', raw.slice(0, 300))

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log('[detect-card] no JSON found in raw:', raw)
      return NextResponse.json({ error: 'pas de JSON dans la réponse' }, { status: 500 })
    }

    let corners: any
    try {
      corners = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.log('[detect-card] JSON parse error:', parseErr, 'raw match:', jsonMatch[0].slice(0, 200))
      return NextResponse.json({ error: 'JSON invalide' }, { status: 500 })
    }
    if (corners.error) return NextResponse.json({ error: corners.error }, { status: 404 })

    const { topLeft, topRight, bottomRight, bottomLeft } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ corners: { topLeft, topRight, bottomRight, bottomLeft } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
