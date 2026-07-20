import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAiRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert mondial en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer, WNBA) et TCG (Pokémon, Magic, Yu-Gi-Oh, One Piece, Dragon Ball, etc.).
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.

{
  "nom": "Joueur/personnage. Multi-joueurs: séparés par ' / '. Carte équipe: nom de l'équipe.",
  "equipe": "Sports US: ville+surnom (ex: Los Angeles Lakers). Soccer: club (ex: Real Madrid). World Cup: nation. Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24, 2023)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Leaf, Sage, Pokémon, Konami, Bandai)",
  "collection": "SET sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select)",
  "variation": "Parallèle ou variante EXACTE. Vide si base standard.",
  "num": "Tirage sériel imprimé: '/Y' ou 'X/Y' (ex: '48/99', '/10', '1/1'). Vide sinon.",
  "card_number": "Numéro set au verso, sans '#' (ex: '48', 'HTR-IFS'). Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ SLABS ═══
Slab PSA/BGS/CGC/SGC/HGA : étiquette = SOURCE PRIORITAIRE. Copie nom, année, collection, variation, num EXACTEMENT de l'étiquette.
grade: "PSA 10" / "BGS 9.5" / "CGC 9" / "SGC 10" / "HGA 10" (note exacte). Illisible → "PSA ?" etc.
"AUTO"→auto=true | "PATCH"/"RELIC"→patch=true | "RC"→rc=true

═══ VARIATIONS ═══

▸ PANINI (Prizm, Optic, Mosaic, Select, Hoops, Donruss, Contenders, Chronicles, Flux, Origins, Court Kings, Revolution, Noir, Obsidian, Encased…)
Nom = EFFET/COULEUR + SET. Ex: "Silver Prizm", "Holo Hoops", "Blue Mosaic".
Base→"" | Holo argenté→"Silver/Holo [Set]" | Couleur unie→"[Couleur] [Set]" | Gold /10→"Gold [Set]" | Black /1→"Black [Set]" | Gold Vinyl/Logoman /1→noter tel quel
Effets: Cracked Ice | Disco | Fast Break | Mojo | Hyper | Laser ("Holo Blue Laser Donruss") | Velocity | Shock | Neon→"Neon [Couleur] [Set]"

INSERTS: nom IMPRIMÉ sur la carte → lire EN PRIORITÉ. Ex: "Bang!" "Stained Glass" "Kaboom" "Court Kings" "Illusions".
Combinaison possible: "Bang! Silver Prizm". Ne pas deviner visuellement sans texte confirmant.

SELECT: niveaux Concourse/Field Level/Premier Level ≠ variation. Parallèles: Silver /149 | Neon Green /75 | Tri-Color /49 | Zebra /35 | Mojo /25 | Gold /10 | Black /1 → "[Parallèle] Select"
PRIZM extra: Pink Ice | Tiger Stripe | Starburst | Wave | White Sparkle /10 | Gold Vinyl /1 → "[Effet] Prizm"
PREMIUM (Immaculate/NT/Noir/Obsidian/Flawless): texte imprimé priorité absolue.
  Immaculate: Gold /10 | Ruby /5 | Black /1 · NT: Gold /10 | Ruby /5 | Laundry Tag /1 | Logoman /1
  Noir: Amber /79 | Gold /25 | Ruby /10 | Black /1 · Obsidian: Electric Eel /55 | Galaxy /35 | Lava /20 | Purple /10 | Black /1
  Flawless: Sapphire /15 | Ruby /10 | Gold /5 | Diamond /3 | Black /1

▸ TOPPS/BOWMAN
Base→"" | Refractor (miroir irisé)→"Refractor" | Parallèles: Blue /150 | Green /99 | Purple /250 | Sepia /75 | Orange /25 | Gold /50 | Red /5 | SuperFractor /1
Effets: Prism | Atomic | X-Fractor | Negative | Speckle | Wave · Chrome non-Refractor: Gold /50 | Black /25 | Pink /25 | Purple /250
Topps base: Gold /[année] | Rainbow Foil | Independence Day /76 | Black /63 | Platinum /1 · Heritage: SP | Chrome | Black /63 | Chrome Black /5
1st Bowman (logo "1st")→rc=true, variation="" · Topps Now: événement, numérotées · Topps Living: style 1952, hebdo

▸ UPPER DECK: Young Guns→rc=true variation="Young Guns" | Canvas | O-Pee-Chee Retro | Clear Cut | Exclusives /100 | French | SP Authentic Future Watch→rc=true

▸ SOCCER — PANINI
Prizm World Cup/Premier League: mêmes parallèles Prizm NBA · Select FIFA: mêmes niveaux/parallèles Select NBA
Donruss Road to [Pays] | Mosaic FIFA | Chronicles Soccer | Score Soccer | NT Soccer | Immaculate Soccer
equipe=CLUB (ex: Real Madrid, PSG, Bayern) | World Cup→equipe=NATION (ex: France, Brazil)

▸ SOCCER — TOPPS: Chrome UCL: Refractors identiques · Stadium Club | Finest | Gold Label | Match Attax | Allen & Ginter (mini→"Mini")

▸ POKÉMON/TCG
Holo Rare | Reverse Holo | Full Art | Secret Rare | Rainbow Rare | Alt Art | Illustration Rare | Special Illustration Rare | Gold Secret Rare
VMAX/VSTAR/V/ex/GX/EX/LV.X→variation · One Piece/Dragon Ball: raretés C/UC/R/SR/SEC/L/SP→variation

▸ AUTRES: Leaf/Leaf Metal: parallèles couleur · Sage: NFL pre-Draft · Chronicles: nom sous-set (ex: "Chronicles Flux")
Vintage pré-2000 (Fleer/Score/SkyBox/Hoops/Pacific): plupart→variation="" | inserts→lire texte imprimé

═══ RÈGLES ═══

VARIATION: 1.Texte imprimé 2.Étiquette slab 3.Tirage (/10=Gold, /1=Black/SuperFractor) 4.Visuel 5.Standard→""
ANNÉE: verso d'abord (copyright, saison, logo set) puis recto. Slab→étiquette. Copie exactement. Set connu→ta connaissance. Impossible→""
MARQUE vs COLLECTION: "Panini Prizm"→marque=Panini, collection=Prizm
rc: logo RC (étoile jaune), "Rookie Card"/"RC"/"Young Guns"/"1st Bowman", ou "Rookie" dans le nom de l'insert
auto: signature manuscrite ou "Autograph"/"Auto" imprimé (sticker auto inclus)
patch: fenêtre tissu/jersey encapsulée ou "Patch"/"Relic"/"Swatch". Manufactured patch (estampé)→false
num: tirage limité imprimé ≠ card_number (numéro du catalogue au verso)
grade: Raw par défaut. Slab→note exacte de l'étiquette. Info absente→""

QUALITÉ D'IMAGE: à l'envers→lire normalement | sombre→infos visibles + connaissance du set | sleeve/toploader→lire à travers | slab→étiquette d'abord | plusieurs cartes→la plus centrale | floue→joueur + set

SI VERSO: image 1=recto, image 2=verso. Verso fait AUTORITÉ: collection, variation, num, rc, auto, patch, copyright année.`

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
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  try {
    const { imageBase64, imageBase64Verso, mimeType = 'image/jpeg', ebayHints } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })

    // Injecter les titres eBay comme contexte fort quand disponibles
    let fullPrompt = PROMPT
    if (Array.isArray(ebayHints) && ebayHints.length > 0) {
      fullPrompt += `\n\n═══ TITRES EBAY — INDICES PRIORITAIRES ═══\nCes listings correspondent visuellement à cette carte exacte. RÈGLES OBLIGATOIRES :\n• Copie la variation VERBATIM depuis le titre (ex: titre contient "Silver Prizm" → variation="Silver Prizm", titre contient "Blue Hyper Prizm" → variation="Blue Hyper Prizm")\n• Copie l'année VERBATIM (ex: "2023-24 Panini" → annee="2023-24")\n• Si le titre mentionne "RC" ou "Rookie" → rc=true\n• Si le titre mentionne "Auto" ou "Autograph" → auto=true\n• Si le titre contient "/XX" ou "XX/XX" → num="/XX" ou "XX/XX"\n• Ces indices font AUTORITÉ sur tes déductions visuelles — utilise-les sauf contradiction flagrante avec l'image\n` +
        ebayHints.slice(0, 5).map((t: string, i: number) => `${i + 1}. "${t}"`).join('\n')
    }

    const imageParts: object[] = [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
    ]
    if (imageBase64Verso) {
      imageParts.push({ inline_data: { mime_type: mimeType, data: imageBase64Verso } })
    }

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: fullPrompt },
            ...imageParts,
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Gemini error: ' + err }, { status: 500 })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    // Exclure les parties "thought" (raisonnement interne de Gemini 2.5)
    const answerParts = parts.filter((p: any) => !p.thought)
    const text = answerParts.map((p: any) => p.text ?? '').join('')

    const jsonStr = extractFirstJson(text)
    if (!jsonStr) return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })

    const card = JSON.parse(jsonStr)
    return NextResponse.json(card)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
