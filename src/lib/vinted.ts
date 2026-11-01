// Aides serveur pour l'ajout d'un achat Vinted (page « Mes achats ») : reconnaissance d'un lien d'annonce, lecture de
// la page publique (titre, photo, prix) et lecture d'une capture d'écran de commande avec Gemini.
// Vinted n'a pas d'API pour les particuliers : on ne lit QUE la page publique d'une annonce, et la capture que le membre
// partage lui-même. Aucun identifiant Vinted n'est demandé ni utilisé.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// Seuls les liens d'annonces Vinted sont acceptés (protège contre l'appel d'adresses arbitraires depuis le serveur).
const VINTED_ITEM_RE = /https:\/\/(?:www\.)?vinted\.(?:fr|com|de|es|it|nl|be|pl|pt|cz|lt|lu|at|co\.uk|se|dk|fi|hu|ro|sk|hr|gr|ie)\/items\/\d+[^\s"'<>]*/i

export function extractVintedUrl(text: string | null | undefined): string | null {
  const m = (text || '').match(VINTED_ITEM_RE)
  return m ? m[0] : null
}

export type VintedDraft = {
  titre: string | null
  photo_url: string | null        // https (annonce) ou petite image en data URL (recadrée sur la capture)
  prix: number | null             // prix de l'article
  frais_port: number | null
  autres_frais: number | null     // frais de protection acheteur Vinted
  total_paye: number | null
  vendeur: string | null
  achete_at: string | null        // AAAA-MM-JJ
  devise: string
  lien: string | null
  photo_box: [number, number, number, number] | null // [y1, x1, y2, x2] sur 0..1000, pour recadrer la photo de la capture
}

export const emptyDraft = (): VintedDraft => ({
  titre: null, photo_url: null, prix: null, frais_port: null, autres_frais: null, total_paye: null,
  vendeur: null, achete_at: null, devise: 'EUR', lien: null, photo_box: null,
})

async function eurRate(cur: string): Promise<number | null> {
  if (cur === 'EUR') return 1
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', { next: { revalidate: 43200 }, signal: AbortSignal.timeout(6000) })
    const json = await res.json() as { rates?: Record<string, number> }
    const r = json.rates?.[cur]
    return r && r > 0 ? 1 / r : null
  } catch { return null }
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

// Page publique d'une annonce : titre, photo (og:image) et prix (dans la devise du vendeur, converti en euros).
export async function readVintedListing(url: string): Promise<Partial<VintedDraft> | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      signal: AbortSignal.timeout(9000), redirect: 'follow', cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()
    const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1]
    const image = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1]
    const price = html.match(/\\"price\\":\{\\"amount\\":\\"([\d.]+)\\",\\"currency_code\\":\\"([A-Z]{3})\\"\}/)
    const out: Partial<VintedDraft> = { lien: url.split('?')[0] }
    if (title) out.titre = decode(title).replace(/\s*\|\s*Vinted\s*$/i, '').trim()
    if (image) {
      const img = decode(image)
      if (/^https:\/\/images\d*\.vinted\.net\//.test(img)) out.photo_url = img
    }
    if (price) {
      const amount = Number(price[1]), rate = await eurRate(price[2])
      if (Number.isFinite(amount) && rate) { out.prix = Math.round(amount * rate * 100) / 100; out.devise = 'EUR' }
    }
    return out
  } catch { return null }
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    titre: { type: 'STRING', nullable: true },
    prix_article: { type: 'NUMBER', nullable: true },
    frais_port: { type: 'NUMBER', nullable: true },
    frais_protection: { type: 'NUMBER', nullable: true },
    total: { type: 'NUMBER', nullable: true },
    vendeur: { type: 'STRING', nullable: true },
    date: { type: 'STRING', nullable: true },
    devise: { type: 'STRING', nullable: true },
    photo_box: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
  },
}

const PROMPT = `Cette image est une capture d'écran de l'application ou du site Vinted : le détail d'une commande ou d'un achat (en français ou dans une autre langue).
Extrais uniquement ce qui est VISIBLE, sans rien inventer. Mets null pour tout ce qui n'est pas affiché.
- titre : titre de l'article acheté
- prix_article : prix de l'article seul, en nombre (12.5)
- frais_port : frais de livraison / d'expédition payés
- frais_protection : frais de Protection acheteur / frais Vinted
- total : montant total payé
- vendeur : pseudo du vendeur
- date : date de la commande ou de l'achat, au format AAAA-MM-JJ (si l'année manque, prends l'année en cours)
- devise : code ISO de la devise (EUR, GBP, PLN…)
- photo_box : cadre de la photo de l'article dans l'image, [y_min, x_min, y_max, x_max] sur une échelle de 0 à 1000, ou null s'il n'y a pas de photo
Les montants utilisent la virgule décimale en français : convertis-les en nombres (12,50 -> 12.5).`

type Extracted = {
  titre?: string | null; prix_article?: number | null; frais_port?: number | null; frais_protection?: number | null
  total?: number | null; vendeur?: string | null; date?: string | null; devise?: string | null; photo_box?: number[] | null
}

export async function readVintedScreenshot(base64Jpeg: string): Promise<Partial<VintedDraft> | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurée')
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error('Lecture de la capture impossible.')
  const data = await res.json()
  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text || '').join('')
  let x: Extracted
  try { x = JSON.parse(raw) } catch { return null }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : null)
  const out: Partial<VintedDraft> = {
    titre: typeof x.titre === 'string' ? x.titre.slice(0, 200) : null,
    prix: n(x.prix_article), frais_port: n(x.frais_port), autres_frais: n(x.frais_protection), total_paye: n(x.total),
    vendeur: typeof x.vendeur === 'string' ? x.vendeur.slice(0, 80) : null,
    achete_at: typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null,
    devise: typeof x.devise === 'string' && /^[A-Z]{3}$/.test(x.devise) ? x.devise : 'EUR',
  }
  const b = x.photo_box
  if (Array.isArray(b) && b.length === 4 && b.every(v => Number.isFinite(v) && v >= 0 && v <= 1000) && b[2] > b[0] + 20 && b[3] > b[1] + 20) {
    out.photo_box = [b[0], b[1], b[2], b[3]]
  }
  return out
}
