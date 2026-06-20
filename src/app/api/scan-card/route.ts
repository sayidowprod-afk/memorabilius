import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer) et TCG (Pokémon, Magic, etc.) avec une connaissance exhaustive des sets, parallèles et variations.

Analyse cette image de carte et extrais les informations en JSON strict.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

{
  "nom": "Nom complet du joueur ou personnage",
  "equipe": "Nom complet ville + surnom (ex: Los Angeles Lakers, Golden State Warriors). Vide si TCG ou non applicable.",
  "annee": "Année ou saison (ex: 2023-24, 2023, 2022)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Leaf, Fleer, Pokémon, Magic)",
  "collection": "Nom du SET principal sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select, Hoops, Donruss, Bowman, Heritage, Stadium Club, National Treasures, Immaculate, Flawless, Obsidian, Revolution, Noir, Illusions, Court Kings)",
  "variation": "Parallèle ou variante EXACTE visible sur la carte (voir guide ci-dessous). Vide si c'est la base standard.",
  "num": "Numérotation sérielle au format X/Y ou /Y si visible et imprimée (ex: 48/99, /25, /10). Vide sinon.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ GUIDE DES VARIATIONS PAR MARQUE ═══

PANINI PRIZM (NBA/NFL/MLB):
Base → variation = ""
Silver Prizm → "Silver Prizm" (holographique argenté, le plus courant)
Red Prizm → "Red Prizm"
Blue Prizm → "Blue Prizm"
Blue Ice Prizm → "Blue Ice Prizm"
Gold Prizm /10 → "Gold Prizm"
Black Prizm /1 → "Black Prizm"
Green Prizm → "Green Prizm"
Purple Prizm → "Purple Prizm"
Pink Prizm → "Pink Prizm"
Orange Prizm → "Orange Prizm"
Red White Blue → "Red White Blue Prizm"
Cracked Ice → "Cracked Ice Prizm"
Hyper → "Hyper Prizm"
Fast Break → "Fast Break Prizm"
Disco → "Disco Prizm"
Gold Vinyl /1 → "Gold Vinyl Prizm"
Mojo → "Mojo Prizm"

PANINI OPTIC:
Base → ""
Holo → "Holo"
Blue → "Blue Optic"
Red → "Red Optic"
Gold /10 → "Gold Optic"
Black /1 → "Black Optic"
Pink → "Pink Optic"
Purple → "Purple Optic"
Green → "Green Optic"
Orange → "Orange Optic"
Pandora → "Pandora"
Velocity → "Velocity"
Shock → "Shock"
Checkerboard → "Checkerboard"
Rated Rookie → note rc=true

PANINI MOSAIC:
Base → ""
Silver Prizm → "Silver Mosaic"
Pink Camo → "Pink Camo"
Blue → "Blue Mosaic"
Gold → "Gold Mosaic"
Reactive Blue → "Reactive Blue"
Reactive Yellow → "Reactive Yellow"
Camo → "Camo"
Genesis → "Genesis"

PANINI SELECT:
Base (Concourse/Premier/Courtside tier) → ""
Silver → "Silver Select"
Blue/White → "Blue & White Select"
Gold /10 → "Gold Select"
Black /1 → "Black Select"
Tie-Dye → "Tie-Dye"
Light Blue Disco → "Light Blue Disco"

PANINI NATIONAL TREASURES / IMMACULATE:
Ces sets sont souvent numérotés et ont des relics/autos.
Variation = couleur du fond ou bordure visible (Gold, Silver, Black, Platinum, etc.)

TOPPS CHROME (MLB/NFL):
Base → ""
Refractor → "Refractor"
Blue Refractor → "Blue Refractor"
Orange Refractor → "Orange Refractor"
Red Refractor /5 → "Red Refractor"
Gold Refractor /50 → "Gold Refractor"
SuperFractor /1 → "SuperFractor"
Prism Refractor → "Prism Refractor"
Atomic Refractor → "Atomic Refractor"
Negative Refractor → "Negative Refractor"
X-Fractor → "X-Fractor"

TOPPS HERITAGE / BASE:
Base → ""
Short Print → "Short Print"
High Number → "High Number"
Chrome → "Chrome"
Black → "Black"
Blue → "Blue"
Red → "Red"
Gold /50 → "Gold"

UPPER DECK (NHL/NBA):
Young Guns → rc=true, variation="Young Guns"
Canvas → "Canvas"
French → "French"
Clear Cut → "Clear Cut"
Exclusives /100 → "Exclusives"

POKÉMON:
Holo Rare → "Holo Rare"
Reverse Holo → "Reverse Holo"
Full Art → "Full Art"
Secret Rare → "Secret Rare"
Rainbow Rare → "Rainbow Rare"
Gold → "Gold"
VMAX → note dans variation
V → note dans variation
ex → note dans variation

═══ RÈGLES GÉNÉRALES ═══

IDENTIFICATION DE LA VARIATION :
1. Cherche d'abord une indication TEXTUELLE sur la carte (tampons, étiquettes, numéros)
2. Observe la BORDURE : argentée = Silver/Refractor, dorée = Gold, colorée = noter la couleur
3. Observe la TEXTURE du fond : prismatique = Prizm/Holo, craquelée = Cracked Ice, rayures = Velocity
4. Regarde si le numéro de tirage (/25 = souvent Gold ou Red, /10 = Gold, /1 = Black ou SuperFractor)
5. Si base standard sans effet spécial visible → variation = ""

COLLECTION (set) :
- Lis le texte en bas ou en haut de la carte
- Sur les slabs PSA/BGS, le set est souvent indiqué sur l'étiquette
- Panini indique souvent le set sur le bas de la carte
- Topps indique le set logo en haut

RÈGLES BOOLÉENNES :
- rc = true si tu vois "Rookie Card", "RC", logo rookie officiel (étoile jaune), ou "Young Guns" (Upper Deck)
- auto = true si signature manuscrite visible OU "Autograph" OU "Auto" inscrit sur la carte
- patch = true si morceau de tissu/jersey encapsulé visible OU "Patch" OU "Relic" inscrit
- grade = "Raw" par défaut. Si slab PSA visible → "PSA X", BGS → "BGS X.X", CGC → "CGC X"
- num : UNIQUEMENT si tu lis "X/Y" ou "/Y" imprimé sur la carte comme tirage limité. Pas le numéro de carte (#123), pas le numéro de maillot.

Si une info est absente ou vraiment illisible → chaîne vide "".
Ne devine pas. Reste factuel à ce qui est visible.`

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
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Gemini error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: any) => p.text ?? '').join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })

    const card = JSON.parse(match[0])
    return NextResponse.json(card)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
