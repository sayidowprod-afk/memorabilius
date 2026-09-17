import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import sharp from 'sharp'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent'

const PROMPT = `You are looking at a photo of a sports trading card that has a hand-signed autograph on it (ink pen signature, not printed text).

Find the bounding box of ONLY the handwritten signature itself (the ink pen strokes), not the whole card, not a printed "AUTOGRAPH" label, not a certification sticker/hologram.

Encode as fractions of the full image: x/y = top-left corner, w/h = width/height. 0.000=left/top edge, 1.000=right/bottom edge. Add a small margin (~4% of card) around the ink so the crop doesn't clip strokes.

If there are multiple signatures, pick the largest/clearest one. If no handwritten signature is visible, return confidence 0.

One short sentence describing what you see, then JSON (no markdown):
{"x":0.15,"y":0.62,"w":0.55,"h":0.18,"confidence":0.9}`

async function compressImage(buf: Buffer): Promise<string> {
  const out = await sharp(buf).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
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
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl manquante' }, { status: 400 })

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) return NextResponse.json({ error: 'image inaccessible' }, { status: 400 })
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const imageBase64 = await compressImage(buf)

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
