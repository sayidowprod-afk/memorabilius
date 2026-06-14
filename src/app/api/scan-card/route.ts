import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert en cartes de collection sportives (basketball, football, baseball, hockey, soccer, etc.) et TCG.
Analyse cette image de carte et extrais les informations suivantes en JSON strict.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication :
{
  "nom": "Nom complet du joueur (ou personnage TCG)",
  "equipe": "Équipe ou franchise (vide si TCG)",
  "annee": "Année ou saison (ex: 2023-24 ou 2023)",
  "collection": "Marque et set (ex: Panini Prizm, Topps Chrome, Pokemon)",
  "variation": "Variante ou parallèle (ex: Silver Prizm, Refractor, Holo)",
  "num": "Numérotation sérielle UNIQUEMENT si format X/Y ou /Y visible (ex: 48/99, /25). Vide sinon.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

Règles :
- rc = true si tu vois "Rookie Card", "RC", ou logo rookie
- auto = true si tu vois une signature manuscrite ou "Autograph"
- patch = true si tu vois un morceau de tissu/jersey encapsulé ou "Patch"
- grade = "Raw" par défaut, sauf si tu vois un grade PSA/BGS/CGC visible
- num : SEULEMENT si tu vois explicitement "X/Y" ou "/Y" imprimé sur la carte (tirage limité). Le numéro de carte du set (ex: #123), le numéro de maillot, ou tout autre nombre NE compte PAS
- Si une info est absente ou illisible, mets une chaîne vide ""
- Ne devine pas, reste factuel à ce qui est visible sur la carte`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Gemini error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: any) => p.text ?? '').join('')

    console.log('Gemini parts:', JSON.stringify(parts.map((p: any) => ({ type: p.thought ? 'thought' : 'text', len: (p.text ?? '').length }))))
    console.log('Gemini text:', text.slice(0, 500))

    // Extraire le JSON de la réponse (parfois Gemini ajoute du texte autour)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Réponse invalide: ' + text.slice(0, 200) }, { status: 500 })

    const card = JSON.parse(match[0])
    return NextResponse.json(card)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
