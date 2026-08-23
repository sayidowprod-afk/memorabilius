import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { GuideBlock } from '@/lib/guideBlockTypes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const LANG_NAMES: Record<'en' | 'de', string> = { en: 'anglais', de: 'allemand' }

// Extrait uniquement les champs textuels traduisibles d'un guide (jamais les
// données structurées : noms de joueurs/sets dans les pyramides/grilles
// d'inserts, IDs de setlist, URLs d'images...). On ne fait traduire que ces
// chaînes par l'IA, puis on les réinjecte dans une COPIE du JSON original —
// bien plus sûr que de faire réécrire toute la structure blocks par le
// modèle, qui pourrait sinon corrompre des données non-textuelles.
interface TranslatableItem { blockIndex: number; key: 'html' | 'caption' | 'title'; text: string }

function collectTranslatable(blocks: GuideBlock[]): TranslatableItem[] {
  const items: TranslatableItem[] = []
  blocks.forEach((b, i) => {
    if ((b.type === 'text' || b.type === 'text_image') && b.html?.trim()) items.push({ blockIndex: i, key: 'html', text: b.html })
    if (b.type === 'image' && b.caption?.trim()) items.push({ blockIndex: i, key: 'caption', text: b.caption })
    if (b.type === 'pyramid' && b.title?.trim()) items.push({ blockIndex: i, key: 'title', text: b.title })
    if (b.type === 'insert_grid' && b.title?.trim()) items.push({ blockIndex: i, key: 'title', text: b.title })
    if (b.type === 'setlist_embed' && b.title?.trim()) items.push({ blockIndex: i, key: 'title', text: b.title })
  })
  return items
}

function applyTranslations(blocks: GuideBlock[], items: TranslatableItem[], translated: string[]): GuideBlock[] {
  const copy: GuideBlock[] = JSON.parse(JSON.stringify(blocks))
  items.forEach((item, idx) => {
    const value = typeof translated[idx] === 'string' && translated[idx].trim() ? translated[idx] : item.text
    ;(copy[item.blockIndex] as any)[item.key] = value
  })
  return copy
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

async function translateStrings(strings: string[], langName: string, apiKey: string): Promise<string[]> {
  if (strings.length === 0) return []
  const prompt = `Tu es un traducteur professionnel français → ${langName}, spécialisé dans le hobby de la carte à collectionner (trading cards de sport et TCG).

Traduis chaque chaîne du tableau JSON ci-dessous du français vers le ${langName}.

RÈGLES STRICTES :
- Certaines chaînes contiennent du HTML (balises <h2>, <p>, <table>, <ul data-type="taskList">, <div data-callout="tip">, etc.) — préserve EXACTEMENT toutes les balises, attributs et structure, ne traduis QUE le texte visible entre les balises.
- Ne traduis JAMAIS : noms de joueurs, noms de marques (Panini, Topps, Prizm, Chrome...), noms de sets/collections, numéros, chiffres, URLs, noms propres.
- Garde le ton, le niveau de langue et la longueur approximative.
- Réponds UNIQUEMENT avec un tableau JSON de chaînes, dans le même ordre, la même longueur, sans aucun texte ni markdown autour.

${JSON.stringify(strings)}`

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`)
  const data = await res.json()
  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('')
  const jsonStr = extractJsonArray(raw)
  if (!jsonStr) throw new Error('Réponse Gemini sans tableau JSON')
  const parsed = JSON.parse(jsonStr)
  if (!Array.isArray(parsed) || parsed.length !== strings.length) throw new Error('Tableau traduit de longueur inattendue')
  return parsed
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })

  const { guideId } = await req.json()
  if (!guideId) return NextResponse.json({ error: 'guideId manquant' }, { status: 400 })

  const { data: guide } = await supabase.from('guides').select('title, excerpt, cover_image, blocks').eq('id', guideId).single()
  if (!guide) return NextResponse.json({ error: 'Guide introuvable' }, { status: 404 })

  // Ne pas écraser une image de couverture déjà personnalisée par langue (voir
  // /admin/guides/[id]) lors d'une retraduction — seule la toute première
  // traduction hérite de la couverture française comme point de départ.
  const { data: existing } = await supabase.from('guide_translations').select('lang').eq('guide_id', guideId)
  const existingLangs = new Set((existing || []).map(r => r.lang))

  const blocks: GuideBlock[] = guide.blocks || []
  const items = collectTranslatable(blocks)
  const results: Record<string, string> = {}

  for (const lang of ['en', 'de'] as const) {
    try {
      const strings = [guide.title, guide.excerpt || '', ...items.map(i => i.text)]
      const translated = await translateStrings(strings, LANG_NAMES[lang], apiKey)
      const [title, excerpt, ...itemStrings] = translated
      const translatedBlocks = applyTranslations(blocks, items, itemStrings)

      const payload: Record<string, any> = {
        guide_id: guideId, lang, title, excerpt: excerpt || null, blocks: translatedBlocks, translated_at: new Date().toISOString(),
      }
      if (!existingLangs.has(lang)) payload.cover_image = guide.cover_image

      const { error: upsertErr } = await supabase.from('guide_translations').upsert(payload, { onConflict: 'guide_id,lang' })
      if (upsertErr) throw upsertErr
      results[lang] = 'ok'
    } catch (e: any) {
      results[lang] = 'error: ' + e.message
    }
  }

  const hasError = Object.values(results).some(v => v !== 'ok')
  return NextResponse.json({ results }, { status: hasError ? 207 : 200 })
}
