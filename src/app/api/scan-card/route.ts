import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAiRateLimit } from '@/lib/rateLimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROMPT = `Tu es un expert en cartes de collection sportives (NBA, NFL, MLB, NHL, soccer) et TCG (Pokémon, Magic, etc.).

Analyse cette image de carte et extrais les informations en JSON strict.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

{
  "nom": "Nom complet du joueur ou personnage",
  "equipe": "Nom complet ville + surnom (ex: Los Angeles Lakers). Vide si TCG.",
  "annee": "Année ou saison (ex: 2023-24, 2023, 2022)",
  "marque": "Fabricant (ex: Panini, Topps, Upper Deck, Leaf, Pokémon)",
  "collection": "Nom du SET sans la marque (ex: Prizm, Chrome, Mosaic, Optic, Select, Hoops, Donruss, Bowman, Heritage, National Treasures, Immaculate, Flawless)",
  "variation": "Parallèle ou variante EXACTE. Vide si carte de base standard.",
  "num": "Numérotation sérielle X/Y ou /Y imprimée (ex: 48/99, /10). Vide sinon.",
  "card_number": "Numéro du set au verso (ex: '48', 'HTR-IFS'). Sans '#'. Vide si absent.",
  "grade": "Raw",
  "rc": false,
  "auto": false,
  "patch": false
}

═══ VARIATIONS — GUIDE ═══

▸ PANINI — règle universelle valable pour TOUS les sets (Prizm, Optic, Mosaic, Select, Hoops, Donruss, Contenders, Chronicles, Flux, Origins, Court Kings, Revolution, Noir, Obsidian…)

Les parallèles suivent la même logique dans tous les sets Panini.
Nom de variation = EFFET ou COULEUR + SET. Exemples : "Silver Prizm", "Holo Hoops", "Blue Mosaic", "Cracked Ice Prizm".

Aspect visuel :
  Base standard → ""
  Holographique irisé argenté → "Silver [Set]" ou "Holo [Set]"
  Couleur unie (Blue, Red, Green, Purple, Orange, Pink) → "[Couleur] [Set]"
  Doré (souvent /10) → "Gold [Set]"
  Noir (souvent /1) → "Black [Set]"
  Gold Vinyl, Logoman (/1) → noter tel quel

Effets texturaux (combiner avec la couleur si applicable) :
  Cracked Ice / Shimmer → texture craquelée irisée → "Cracked Ice [Set]"
  Disco → damier de points irisés → "Disco [Set]"
  Fast Break → fines lignes diagonales argentées → "Fast Break [Set]"
  Mojo → larges bandes arc-en-ciel → "Mojo [Set]"
  Hyper → prismatique intense multicolore → "Hyper [Set]"
  Laser → fines lignes laser colorées → "[Couleur] Laser [Set]" (ex: "Holo Blue Laser Donruss")
  Velocity → lignes de vitesse parallèles → "Velocity [Set]"
  Shock → marques d'impact/éclats → "Shock [Set]"

▸ INSERTS PANINI (fond/cadre DISTINCT de la base standard) :
RÈGLE CLÉ : le nom de l'insert est presque TOUJOURS IMPRIMÉ sur la carte.
→ Lis le texte imprimé en PRIORITÉ ABSOLUE. Si tu vois "BANG!" → "Bang!". Si "STAINED GLASS" → "Stained Glass".
→ Ne devine PAS l'insert visuellement si aucun texte ne le confirme.
→ Combinaison insert + parallèle possible : "Bang! Silver Prizm", "Stained Glass Gold Prizm"

▸ PANINI SELECT — parallèles spécifiques
  Niveaux de la carte (≠ variation) : Concourse (commun) / Field Level (bleu) / Premier Level (violet/foncé)
  Vrais parallèles : Silver /149 → "Silver Select" | Neon Green /75 → "Neon Green Select"
  Tri-Color /49 → "Tri-Color Select" | Zebra /35 → "Zebra Select" | Mojo /25 → "Mojo Select"
  Gold /10 → "Gold Select" | Black /1 → "Black Select"
  Inserts distincts : Die-Cut, Phenomenon, In The Clutch → nom imprimé sur la carte

▸ PANINI PRIZM — parallèles complémentaires
  Pink Ice → "Pink Ice Prizm" | Tiger Stripe → "Tiger Stripe Prizm" | Starburst → "Starburst Prizm"
  Wave → "Wave Prizm" | White Sparkle /10 → "White Sparkle Prizm" | Gold Vinyl /1 → "Gold Vinyl Prizm"
  Fast Break → "Fast Break Prizm" | Hyper → "Hyper Prizm"

▸ PANINI PREMIUM (Immaculate / National Treasures / Noir / Obsidian)
  Ces produits ultra-premium ont leurs propres parallèles — lire le TEXTE IMPRIMÉ en priorité absolue
  Immaculate : Gold /10 → "Gold Immaculate" | Ruby /5 → "Ruby Immaculate" | Black /1 → "Black Immaculate"
  National Treasures : Gold /10, Ruby /5, Laundry Tag /1, Logoman /1 → noter tel quel
  Noir : Amber /79, Gold /25, Ruby /10, Black /1
  Obsidian : Galaxy /35, Electric Eel /55, Lava /20, Purple /10, Black /1

▸ TOPPS / BOWMAN
  Base papier → ""
  Refractor (aspect miroir légèrement irisé) → "Refractor"
  Parallèles Refractor : "Blue Refractor" /150 | "Green Refractor" /99 | "Purple Refractor" /250
  "Sepia Refractor" /75 | "Orange Refractor" /25 | "Gold Refractor" /50
  "Red Refractor" /5 | "SuperFractor" /1
  Effets : "Prism Refractor" | "Atomic Refractor" | "X-Fractor" | "Negative" | "Speckle"
  Chrome parallèles non-Refractor : "Gold" /50 | "Black" /25 | "Pink" /25 | "Purple" /250
  Topps base sets : "Gold" (numéroté à l'année ex /2025) | "Rainbow Foil" | "Independence Day" /76
  "Black" /63 | "Platinum" /1 | "Pink" /50 | "Orange" /50
  Heritage : "Short Print" (SP) | "Chrome" variante spécifique | "Black" /63
  1st Bowman (logo 1st sur la carte) → rc=true, variation=""
  Inserts (Future Stars, Prospects, etc.) : nom généralement imprimé → lire le texte

▸ UPPER DECK (NHL/NBA)
  Young Guns → rc=true, variation="Young Guns"
  Canvas → "Canvas" | OPC Retro → "O-Pee-Chee Retro" | Clear Cut → "Clear Cut"
  Exclusives /100 → "Exclusives" | French → "French" | Spectrum FoilX → "Spectrum FoilX"

▸ POKÉMON / TCG
  Holo Rare → "Holo Rare" | Reverse Holo → "Reverse Holo" | Full Art → "Full Art"
  Secret Rare → "Secret Rare" | Rainbow Rare → "Rainbow Rare" | Alt Art → "Alt Art"
  VMAX / V / ex / GX / EX / LV.X → noter dans variation
  Gold card / Gold Secret → "Gold Secret Rare"

▸ VINTAGE / CLASSIQUES (pré-2000) — Fleer, Score, SkyBox, Hoops, Classic, Leaf, Pro Set
  La plupart sont des bases → variation=""
  Inserts imprimés sur la carte → lire le texte (Fleer Metal Universe, SkyBox Premium, etc.)
  Upper Deck SP (Special Edition) → variation="SP" | SPx → lire le texte du set
  Score/Pinnacle/Donruss anciens : parallèles rares, souvent imprimés (Score Gold Rush, etc.)

═══ RÈGLES GÉNÉRALES ═══

VARIATION — ORDRE DE PRIORITÉ :
1. Texte imprimé sur la carte → priorité absolue (lis avant de déduire visuellement)
2. Numéro de tirage : /10 = souvent Gold, /1 = Black ou SuperFractor
3. Effet visuel selon le guide ci-dessus
4. Design standard sans effet spécial → ""

ANNÉE :
- Verso en priorité : (1) copyright "© 2025 Panini America", (2) mention saison "2024-25 NBA", (3) logo/texte du set contenant l'année
- Recto : coins supérieur/inférieur, bandeau, texte overlay
- Slab PSA/BGS/CGC : étiquette du slab, source la plus fiable
- Copie exactement ce qui est imprimé : "2025" → "2025", "2024-25" → "2024-25"
- Si l'année n'est PAS lisible dans l'image mais que tu identifies le set avec certitude → utilise ta connaissance pour l'année probable
- Vraiment impossible → ""

COLLECTION : lis le texte en bas/haut/logo de la carte. Sur slab, l'étiquette indique souvent le set.

BOOLÉENS :
- rc : "Rookie Card", "RC", logo rookie étoile jaune, "Young Guns", "1st Bowman"
- auto : signature manuscrite visible, "Autograph" ou "Auto" écrit sur la carte
- patch : morceau de tissu/jersey encapsulé visible, "Patch" ou "Relic" écrit
- grade : "Raw" par défaut. Slab PSA → "PSA X", BGS → "BGS X.X", CGC → "CGC X"
- num : uniquement le tirage limité "/Y" ou "X/Y" imprimé (pas le numéro de carte dans le set)
- card_number : numéro du set au verso, retourner sans '#' (ex: "48" et non "#48"). Vide si absent.
Si info absente ou illisible → ""

SI DEUX IMAGES (RECTO + VERSO) :
- Image 1 = RECTO (face avant), Image 2 = VERSO (face arrière)
- Le verso FAIT AUTORITÉ pour : collection, variation, num, rc, auto, patch
- Le verso contient souvent le nom de l'insert en grand, la numérotation exacte, le copyright avec l'année
- Croiser les deux faces pour la meilleure précision`

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

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })

    const card = JSON.parse(match[0])
    return NextResponse.json(card)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
