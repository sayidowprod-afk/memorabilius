import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAiRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `You are a precise computer vision system for detecting trading card boundaries.

CARD TYPES — detect accordingly:
• Raw card: flat rectangle on a surface, may be inside a soft plastic sleeve → find the card's own printed border
• Toploader / one-touch rigid holder: clear plastic case — find the CARD'S printed border inside it (not the plastic edge; card is slightly inset from toploader walls)
• PSA / BGS / CGC graded slab: thick hard plastic case with label — find the OUTER edge of the ENTIRE SLAB (the slab is the unit to locate)
• When uncertain between toploader and slab: choose the outermost clearly-bounded rectangle

Size reference (helps identify which rectangle is the card):
  Standard trading card: 2.5×3.5 in → portrait ratio ≈ 0.714, landscape ratio ≈ 1.40
  Mini card: ~1.75×2.5 in (same ratio, smaller)
  PSA/BGS slab: ~3×4 in portrait, slightly wider than the card inside

Instructions:
1. Identify the card or slab as a whole physical object — ignore art, text, and holograms printed ON the card.
2. Find the 4 outermost corners where straight edges meet at approximately 90° angles, accounting for perspective distortion.
3. Express each point as a fraction of image dimensions (x: 0.0 = left edge → 1.0 = right edge; y: 0.0 = top → 1.0 = bottom).
4. The 4 points must form a convex quadrilateral inset at least 2% from the image edge on every side.
5. Set confidence honestly — do not inflate it:
   - 0.90–1.00: all 4 corners clearly visible, sharp edges, unambiguous
   - 0.60–0.89: card identified but one or more corners slightly blurred, cut off, or partially occluded
   - 0.00–0.59: heavy blur, multiple overlapping cards, corner(s) hidden, heavy shadow, or significant uncertainty → use freely when in doubt

Return ONLY valid JSON (no markdown, no explanation):
{"topLeft":{"x":0.12,"y":0.08},"topRight":{"x":0.88,"y":0.06},"bottomRight":{"x":0.90,"y":0.94},"bottomLeft":{"x":0.10,"y":0.96},"confidence":0.95}`

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rateLimitErr = await checkAiRateLimit(user.id)
  if (rateLimitErr) return NextResponse.json({ error: rateLimitErr }, { status: 429 })

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
    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = JSON.parse(text)
    const raw = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? ''

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'pas de JSON' }, { status: 500 })

    const corners = JSON.parse(match[0])
    const { topLeft, topRight, bottomRight, bottomLeft, confidence } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ topLeft, topRight, bottomRight, bottomLeft, confidence: confidence ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
