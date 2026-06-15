import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg', width, height } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'image manquante' }, { status: 400 })

    const prompt = `Cette image contient une carte de collection (carte sport, trading card) photographiée sur un fond.
Trouve les 4 coins EXACTS de la carte visible dans l'image.
L'image fait ${width}x${height} pixels.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication :
{"tl":{"x":0,"y":0},"tr":{"x":0,"y":0},"br":{"x":0,"y":0},"bl":{"x":0,"y":0}}

tl=haut-gauche, tr=haut-droit, br=bas-droit, bl=bas-gauche.
Les coordonnées sont en pixels (x=colonne depuis la gauche, y=ligne depuis le haut).
Sois précis — c'est pour recadrer automatiquement la carte.`

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 128, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: any) => p.text ?? '').join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'no json' }, { status: 500 })

    const corners = JSON.parse(match[0])
    const keys = ['tl', 'tr', 'br', 'bl']
    if (!keys.every(k => typeof corners[k]?.x === 'number' && typeof corners[k]?.y === 'number'))
      return NextResponse.json({ error: 'invalid corners' }, { status: 500 })

    // Validation : les coins doivent former un quadrilatère raisonnable
    const { tl, tr, br, bl } = corners
    const area = Math.abs((tr.x - tl.x) * (bl.y - tl.y) - (bl.x - tl.x) * (tr.y - tl.y)) / 2
    if (area < width * height * 0.05)
      return NextResponse.json({ error: 'zone trop petite' }, { status: 500 })

    return NextResponse.json(corners)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
