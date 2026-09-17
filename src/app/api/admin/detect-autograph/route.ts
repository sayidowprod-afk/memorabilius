import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import sharp from 'sharp'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent'

const PROMPT = `You are a precise computer vision system looking at an upright photo of a basketball trading card with a hand-signed autograph (ink/paint pen strokes on the card or on a jersey swatch/sticker patch attached to it).

TASK: find the TIGHT bounding box around ONLY the handwritten ink strokes of the signature. Not the whole card. Not the player photo. Not a printed "AUTOGRAPH"/"CERTIFIED" label or hologram sticker text. Not the jersey swatch itself if the signature is written elsewhere.

RULES:
- The box must hug the ink closely on all 4 sides, then add a small margin of about 6% of the box's own width/height (not of the whole card) so strokes aren't clipped.
- Signature is usually a single continuous scrawl of curved/looping lines, often diagonal, in blue/black/silver/gold ink -- distinct from printed text (which is uniform font, straight baseline) and from photo content.
- If there are several separate signatures, pick the largest/most legible one.
- If genuinely no handwritten ink signature is visible anywhere, return confidence 0 and a box of zeros.

Encode as fractions of the full image: x/y = top-left corner, w/h = width/height. 0.000=left/top edge, 1.000=right/bottom edge.

One short sentence: where exactly is the ink (e.g. "diagonal blue ink signature across the lower-left jersey patch"). Then JSON (no markdown):
{"x":0.15,"y":0.62,"w":0.55,"h":0.18,"confidence":0.9}`

async function compressImage(buf: Buffer, rotate: boolean): Promise<string> {
  let pipeline = sharp(buf)
  // Cartes "horizontales" stockees en orientation brute (portrait, tournee) --
  // meme convention que l'affichage (GalerieClient.tsx, rotate(90deg)) : sans
  // ca, Gemini voit une image de travers et ses coordonnees de boite ne
  // correspondent plus au cadrage upright affiche/enregistre cote admin.
  if (rotate) pipeline = pipeline.rotate(90)
  const out = await pipeline.resize(1100, 1100, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()
  return out.toString('base64')
}

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

// Detection de la zone de signature (bounding box) sur une carte auto, pour
// le quiz "devine le joueur" (voir autograph_quiz_cards) -- endpoint dedie et
// separe de /api/detect-corners (qui localise la carte elle-meme, pas la
// signature dessus). Admin uniquement, jamais expose aux utilisateurs.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 500 })

  try {
    const { imageUrl, rotate } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl manquante' }, { status: 400 })

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) return NextResponse.json({ error: 'image inaccessible' }, { status: 400 })
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const imageBase64 = await compressImage(buf, !!rotate)

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: 'gemini error: ' + text.slice(0, 200) }, { status: 500 })

    const data = JSON.parse(text)
    const raw = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? ''
    const jsonStr = extractFirstJson(raw)
    if (!jsonStr) return NextResponse.json({ error: 'pas de JSON' }, { status: 500 })

    const box = JSON.parse(jsonStr)
    const { x, y, w, h, confidence } = box
    if ([x, y, w, h].some(v => typeof v !== 'number')) {
      return NextResponse.json({ error: 'zone invalide' }, { status: 500 })
    }
    return NextResponse.json({ x, y, w, h, confidence: confidence ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
