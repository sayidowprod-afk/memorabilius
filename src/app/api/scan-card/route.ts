import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAiRateLimit } from '@/lib/rateLimit'
import sharp from 'sharp'

async function compressImage(base64: string): Promise<string> {
  const buf = Buffer.from(base64, 'base64')
  const out = await sharp(buf)
    .resize(700, 700, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return out.toString('base64')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert en cartes de collection sportives et TCG. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.

{
  "nom": "Joueur/personnage. Multi: séparés par ' / '. Carte équipe: nom équipe.",
  "equipe": "Sports US: ville+surnom (ex: Los Angeles Lakers). Soccer: club. World Cup: nation. Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24). Lis sur la carte.",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Pokémon, Konami)",
  "collection": "Set sans la marque (ex: Prizm, Chrome, Mosaic, Select)",
  "variation": "Parallèle/variante EXACTE imprimée. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y'. Vide sinon.",
  "card_number": "Numéro au verso, sans '#'. Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ SLABS (PSA/BGS/CGC/SGC/HGA) ═══
Étiquette = SOURCE PRIORITAIRE. Copie nom, année, collection, variation, num EXACTEMENT de l'étiquette.
grade: "PSA 10" / "BGS 9.5" / "CGC 9" / "SGC 10" / "HGA 10". Illisible → "PSA ?" etc.
AUTO→auto=true | PATCH/RELIC→patch=true | RC→rc=true

═══ VARIATIONS ═══
PRIORITÉ: 1.Texte imprimé 2.Étiquette slab 3.Tirage inferré 4.Visuel 5.Base→""

PANINI: variation = EFFET/COULEUR + SET. Ex: "Silver Prizm", "Holo Hoops", "Blue Mosaic", "Cracked Ice Select".
/10 non imprimé→"Gold [Set]" | /1→"Black [Set]" (ou "Gold Vinyl/Logoman" si applicable).
Inserts: lire NOM IMPRIMÉ en priorité (ex: "Bang!", "Stained Glass", "Kaboom"). Combo: "Bang! Silver Prizm".
Select: niveaux Concourse/Field Level/Premier Level ≠ variation (ne pas inclure dans variation).
Premium (Immaculate/NT/Noir/Obsidian/Flawless): texte imprimé priorité absolue, sinon ta connaissance du set.

TOPPS/BOWMAN: Refractor (miroir irisé)→"Refractor". 1st Bowman→rc=true, variation="".
UPPER DECK: Young Guns→rc=true, variation="Young Guns". SP Authentic Future Watch→rc=true.
SOCCER: equipe=CLUB (ex: Real Madrid) ou NATION si World Cup (ex: France). Mêmes règles parallèles que NBA.
POKÉMON/TCG: VMAX/VSTAR/V/ex/GX/EX→inclure dans variation. Rareté (Holo Rare, Full Art, Alt Art…)→variation.

═══ RÈGLES ═══
MARQUE vs COLLECTION: "Panini Prizm"→marque=Panini, collection=Prizm.
ANNÉE: verso d'abord (copyright, logo set). Slab→étiquette. Set connu→ta connaissance. Impossible→"".
rc: logo RC (étoile jaune), "Rookie Card"/"RC"/"Young Guns"/"1st Bowman", ou "Rookie" dans l'insert.
auto: signature manuscrite ou "Autograph"/"Auto" imprimé (sticker inclus).
patch: fenêtre tissu/jersey encapsulée. Manufactured patch (estampé en plastique)→false.
num ≠ card_number: num=tirage limité imprimé, card_number=numéro catalogue au verso.
Image: à l'envers→lire normalement | sleeve/toploader→lire à travers | slab→étiquette d'abord | plusieurs cartes→la plus centrale.
SI VERSO: image 1=recto, image 2=verso. Verso AUTORITÉ: collection, variation, num, rc, auto, patch, année.`

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

  try {
    const { imageBase64: rawRecto, imageBase64Verso: rawVerso, ebayHints } = await req.json()
    if (!rawRecto) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })

    const imageBase64 = await compressImage(rawRecto)
    const imageBase64Verso = rawVerso ? await compressImage(rawVerso) : undefined

    const modalUrl = process.env.MODAL_SCAN_URL

    if (modalUrl) {
      // ── Modèle maison via Modal ──────────────────────────────
      const body: Record<string, string> = { recto: imageBase64 }
      if (imageBase64Verso) body.verso = imageBase64Verso

      const res = await fetch(modalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: 'Modal error: ' + err }, { status: 500 })
      }

      const card = await res.json()
      if (card.error) return NextResponse.json({ error: card.error }, { status: 500 })
      return NextResponse.json(card)
    }

    // ── Fallback Gemini ──────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

    let fullPrompt = PROMPT
    if (Array.isArray(ebayHints) && ebayHints.length > 0) {
      fullPrompt += `\n\n═══ TITRES EBAY — INDICES PRIORITAIRES ═══\nCes listings correspondent visuellement à cette carte exacte. RÈGLES OBLIGATOIRES :\n• Copie la variation VERBATIM depuis le titre (ex: titre contient "Silver Prizm" → variation="Silver Prizm", titre contient "Blue Hyper Prizm" → variation="Blue Hyper Prizm")\n• Copie l'année VERBATIM (ex: "2023-24 Panini" → annee="2023-24")\n• Si le titre mentionne "RC" ou "Rookie" → rc=true\n• Si le titre mentionne "Auto" ou "Autograph" → auto=true\n• Si le titre contient "/XX" ou "XX/XX" → num="/XX" ou "XX/XX"\n• Ces indices font AUTORITÉ sur tes déductions visuelles — utilise-les sauf contradiction flagrante avec l'image\n` +
        ebayHints.slice(0, 5).map((t: string, i: number) => `${i + 1}. "${t}"`).join('\n')
    }

    const imageParts: object[] = [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }]
    if (imageBase64Verso) imageParts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64Verso } })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Gemini error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const answerParts = parts.filter((p: any) => !p.thought)
    const text = answerParts.map((p: any) => p.text ?? '').join('')

    const jsonStr = extractFirstJson(text)
    if (!jsonStr) return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonStr))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
