import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAiRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent'

const PROMPT = `You are a precise computer vision system. Locate the exact physical boundary of a trading card and return its 4 corners as coordinate fractions.

CARD: physical rectangle, portrait ratio ≈0.714 (2.5×3.5 in) or landscape ≈1.40, never square. Glossy/matte/foil surface different from background. Faint shadow at each edge. Printed design always inset from physical edge.

CONTAINERS:
Raw card → outermost physical edge
Soft sleeve → card edge inside (~1 mm gap, near-invisible)
Toploader / one-touch → card's printed edge INSIDE (plastic rim is several mm thick — ignore it)
Slab PSA/BGS/CGC/SGC → outer edge of entire slab including label

THINK FIRST: one sentence — card type, container, background, position, corners visible? Then JSON.
Example: "Raw NBA Prizm portrait on dark fabric, centered, all corners clear."

PROCESS:
1. Identify card as one physical object. Exclude: background, hands, non-card rectangles (books, phones, frames, tiles, screens).
2. Find 4 PHYSICAL CORNERS where straight edges meet — NOT corners of artwork, patch windows, holograms, text boxes.
3. Label clockwise from image corner nearest each: topLeft → topRight → bottomRight → bottomLeft (even when card is tilted).
4. Tilted cards: corners appear skewed — expected. Project edge lines to find true intersections.
5. Encode 3 decimal places: x 0.000=left 1.000=right; y 0.000=top 1.000=bottom. All 4 points ≥2% inside image edges.
6. Self-check: quad ratio must be ≈0.714 or ≈1.40. If ≈1.0 (square) → wrong object, reconsider.

HARD CASES:
Dark-on-dark / light-on-light → shadow line at card edge + texture change (card=glossy, background=rough)
Glare on card → it's inside the boundary; project visible edges to find corners behind glare
Partial off-frame → project visible edges; lower confidence
Multiple cards → most central/sharpest | Hand → ignore it

AVOID: ✗ image-frame corners ✗ internal design element corners ✗ toploader outer rim ✗ square result ✗ high confidence when uncertain

CONFIDENCE:
0.90–1.00 all 4 sharp, unambiguous
0.70–0.89 card certain, 1–2 corners slightly blurred/clipped
0.40–0.69 card found, 1–2 corners uncertain
0.15–0.39 barely visible, mostly estimates
0.00–0.14 no card found
Wrong + high confidence is worse than honest low confidence.

One sentence, then JSON (no markdown):
{"topLeft":{"x":0.120,"y":0.080},"topRight":{"x":0.882,"y":0.063},"bottomRight":{"x":0.901,"y":0.941},"bottomLeft":{"x":0.098,"y":0.957},"confidence":0.95}`

function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

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
          maxOutputTokens: 400,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: 'gemini error' }, { status: 500 })

    const data = JSON.parse(text)
    const raw = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? ''

    const jsonStr = extractFirstJson(raw)
    if (!jsonStr) return NextResponse.json({ error: 'pas de JSON' }, { status: 500 })

    const corners = JSON.parse(jsonStr)
    const { topLeft, topRight, bottomRight, bottomLeft, confidence } = corners
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      return NextResponse.json({ error: 'coins manquants' }, { status: 500 })
    }

    return NextResponse.json({ topLeft, topRight, bottomRight, bottomLeft, confidence: confidence ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
