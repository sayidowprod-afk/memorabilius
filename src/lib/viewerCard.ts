import type { ViewerCardData } from '@/components/Viewer3D'

// Ligne de `cartes_manuelles` -> carte telle que le viewer 3D l'attend (même correspondance que la galerie).
export type CardRow = Record<string, unknown> & { id?: string }

export function toViewerCard(r: CardRow): ViewerCardData {
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    f: s(r.image_recto), b: s(r.image_verso) || s(r.image_recto),
    fHd: s(r.image_recto_hd) || undefined, bHd: s(r.image_verso_hd) || undefined,
    n: s(r.nom), t: s(r.equipe), y: s(r.annee), br: s(r.marque), s: s(r.collection), v: s(r.variation),
    num: s(r.num), card_number: s(r.card_number) || undefined,
    auto: !!r.auto, rc: !!r.rc, patch: !!r.patch, g: s(r.grade) || 'Raw',
    isManuelle: true, id_manuelle: r.id as string | undefined,
    is_horizontal: !!r.is_horizontal, verso_is_horizontal: (r.verso_is_horizontal as boolean | null | undefined) ?? null,
    format: s(r.format) || undefined, booklet: !!r.booklet,
    il: s(r.image_interieur_gauche) || undefined, ir: s(r.image_interieur_droite) || undefined,
    collection_tag: s(r.collection_tag) || undefined, quantite: (r.quantite as number) || 1,
  }
}
