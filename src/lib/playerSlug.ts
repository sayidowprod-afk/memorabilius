export function playerSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function teamSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Normalise un nom pour comparaison insensible aux accents/ponctuation/casse
// "Nikola Jokić" et "nikola-jokic" (reconstruit depuis un slug) donnent le même résultat
export function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Slug SEO d'une carte : nom + année + marque + set, pour un mot-clé riche dans l'URL
// (ex: "michael-jordan-1993-94-upper-deck"). Utilisé pour /galerie/[userId]/[cardSlug].
export function cardSlug(nom: string, annee?: string, marque?: string, collection?: string): string {
  return playerSlug([nom, annee, marque, collection].filter(Boolean).join(' '))
}

// URL canonique de la fiche publique d'une carte, indexable par les moteurs de recherche
export function cardPageUrl(userId: string, card: { nom: string; annee?: string; marque?: string; collection?: string; image_recto: string }): string {
  return `/galerie/${userId}/${cardSlug(card.nom, card.annee, card.marque, card.collection)}?src=${encodeURIComponent(card.image_recto)}`
}
