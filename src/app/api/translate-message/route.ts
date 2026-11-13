import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'

export const maxDuration = 20

const admin = createServerServiceClient()
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const LANGS: Record<string, string> = { fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol', it: 'italien' }

// POST { text, target } : traduit UN message reçu dans la langue du membre (sans rien enregistrer). Membre connecté uniquement, avec une limite d'usage.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'translate-message', 40, 60 * 60 * 1000)) return NextResponse.json({ error: 'Trop de traductions : réessaie plus tard.' }, { status: 429 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Traduction indisponible' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const text = String(body?.text || '').trim().slice(0, 1500)
  const target = LANGS[String(body?.target)] ? String(body.target) : 'fr'
  if (text.length < 2) return NextResponse.json({ error: 'Message vide' }, { status: 400 })

  const prompt = 'Traduis ce message d’un collectionneur de cartes en ' + LANGS[target] + '. Réponds UNIQUEMENT avec la traduction, sans commentaire ni guillemets. Garde tels quels les noms de joueurs, d’équipes, de sets, les prix, les liens et les émojis. Si le message est déjà en ' + LANGS[target] + ', renvoie-le identique.\n\nMessage :\n' + text
  try {
    const r = await fetch(GEMINI_URL + '?key=' + apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1200 } }),
    })
    if (!r.ok) return NextResponse.json({ error: 'Traduction indisponible' }, { status: 502 })
    const d = await r.json()
    const out = String(d?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    if (!out) return NextResponse.json({ error: 'Traduction vide' }, { status: 502 })
    return NextResponse.json({ text: out })
  } catch { return NextResponse.json({ error: 'Traduction indisponible' }, { status: 502 }) }
}
