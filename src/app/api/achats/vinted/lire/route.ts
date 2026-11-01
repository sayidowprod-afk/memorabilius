import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/shipmentServer'
import { emptyDraft, extractVintedUrl, readVintedListing, readVintedScreenshot, type VintedDraft } from '@/lib/vinted'

export const maxDuration = 60

// Préparation d'un achat Vinted : lit le lien de l'annonce (titre, photo, prix) et/ou la capture d'écran de la commande
// (prix, port, frais, total, vendeur, date) et renvoie un brouillon que le membre vérifie avant d'enregistrer.
// Limite : 20 lectures par heure et par membre (chaque lecture de capture est un appel payant à Gemini).
const calls = new Map<string, number[]>()
function tooMany(userId: string) {
  const now = Date.now(), recent = (calls.get(userId) || []).filter(t => now - t < 3600000)
  if (recent.length >= 20) { calls.set(userId, recent); return true }
  recent.push(now); calls.set(userId, recent)
  return false
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const body = await req.json().catch(() => null) as { url?: string; image?: string } | null
    const url = extractVintedUrl(body?.url)
    const image = typeof body?.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : ''
    if (!url && !image) return NextResponse.json({ error: 'Ajoute un lien d’annonce Vinted ou une capture de ta commande.' }, { status: 400 })
    if (image.length > 5_500_000) return NextResponse.json({ error: 'Image trop lourde.' }, { status: 413 })
    if (tooMany(user.id)) return NextResponse.json({ error: 'Trop de lectures : réessaie dans un moment.' }, { status: 429 })

    const [listing, shot] = await Promise.all([
      url ? readVintedListing(url) : Promise.resolve(null),
      image ? readVintedScreenshot(image).catch(() => null) : Promise.resolve(null),
    ])
    if (url && !listing && !shot) {
      return NextResponse.json({ error: 'Impossible de lire cette annonce (supprimée ou protégée). Ajoute plutôt une capture de ta commande, ou remplis à la main.' }, { status: 422 })
    }

    // la capture donne ce qui a été réellement payé ; l'annonce complète le titre, la photo et, à défaut, le prix
    const d: VintedDraft = { ...emptyDraft(), ...(listing || {}), ...Object.fromEntries(Object.entries(shot || {}).filter(([, v]) => v !== null && v !== undefined)) } as VintedDraft
    if (listing?.prix != null && (shot?.prix == null)) d.prix = listing.prix
    if (listing?.photo_url) d.photo_url = listing.photo_url
    if (listing?.lien) d.lien = listing.lien
    if (d.total_paye == null && d.prix != null) d.total_paye = Math.round(((d.prix || 0) + (d.frais_port || 0) + (d.autres_frais || 0)) * 100) / 100
    return NextResponse.json({ draft: d, lu: { annonce: !!listing, capture: !!shot } })
  } catch {
    return NextResponse.json({ error: 'Lecture impossible pour le moment.' }, { status: 500 })
  }
}
