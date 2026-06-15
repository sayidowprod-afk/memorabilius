import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `This image shows a cropped region containing a sports/trading card. The card fills most of the frame.

Find the exact 4 corners of the card and return their positions as fractions of this image's width and height (0.0 = left/top edge, 1.0 = right/bottom edge).

Respond ONLY with valid JSON, no markdown:
{"topLeft":{"x":0.05,"y":0.04},"topRight":{"x":0.95,"y":0.04},"bottomRight":{"x":0.95,"y":0.96},"bottomLeft":{"x":0.05,"y":0.96}}

Rules:
- Find the physical corners of the card, even if slightly tilted
- x = horizontal (0=left, 1=right), y = vertical (0=top, 1=bottom)
- Values should be between 0.0 and 1.0`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    const text = await res.text()
    console.log('[detect-corners] Gemini status:', res.status, text.slice(0, 300))
    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = JSON.parse(text)
    const raw = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? ''
    console.log('[detect-corners] raw:', raw.slice(0, 200))

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'pas de JSON' }, { status: 500 })

    const corners = JSON.parse(match[0])
    const { topLeft, topRight, bottomRight, bottomLeft } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ topLeft, topRight, bottomRight, bottomLeft })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
