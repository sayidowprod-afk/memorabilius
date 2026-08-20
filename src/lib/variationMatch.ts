// TCDB n'itemise pas les parallèles couleur dans ses checklists/Team Set Checklists
// (voir capture de référence fournie par l'utilisateur) : "Aqua Refractor", "Wave
// Red", "Black Geometric Refractor"... sont la MÊME carte physique que la version de
// base, juste recolorée — pas la peine de lister chaque couleur séparément. La base
// de données ne distingue pas ce cas (un seul champ texte libre `variation`, scrapé
// tel quel depuis TCDB), mais le bloc pyramide du guide énumère déjà, à la main, tous
// les noms de parallèles couleur pour ce set précis (ex: "WAVE RED", "BASKETBALL
// AQUA", "REFRACTOR"...). On s'en sert comme vocabulaire pour reconnaître et retirer
// le suffixe couleur d'une variation, plutôt qu'une comparaison de nom exacte : le
// nom de la carte de base ("Fortune 15", "Chromographs", "1980-81 Topps Basketball
// Autograph"...) reste immuable d'une couleur à l'autre, seul le SUFFIXE change
// ("Aqua Refractor", "Black Geometric Refractor"...) — donc on ne retire que les mots
// en fin de chaîne qui appartiennent au vocabulaire couleur, jamais un mot au milieu
// (ce qui protège "Basketball" dans "1980-81 Topps Basketball Autograph Black" par
// exemple : on s'arrête dès qu'on rencontre "Autograph", qui n'est pas une couleur).
// Sépare aussi les mots composés en camelCase issus du scraping (ex: "RayWave" ->
// "Ray Wave") avant de découper sur la ponctuation/espaces — sinon "RayWave" ne
// matche ni "ray" ni "wave" pris séparément dans le vocabulaire.
function wordTokens(s: string): string[] {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

export function buildColorVocab(pyramidRowNames: string[]): Set<string> {
  const vocab = new Set<string>(['refractor'])
  for (const name of pyramidRowNames) for (const t of wordTokens(name)) vocab.add(t)
  return vocab
}

// Retire les mots de fin de chaîne appartenant au vocabulaire couleur/motif. Un mot
// composé (ex: "RayWave", scrapé sans espace) n'est retiré que si TOUS ses
// sous-tokens sont dans le vocabulaire. Renvoie la chaîne restante (peut être vide
// si la variation n'était qu'un empilement de mots couleur, ex: "Aqua Refractor").
export function stripColorSuffix(variation: string, vocab: Set<string>): string {
  const words = variation.trim().split(/\s+/).filter(Boolean)
  let end = words.length
  while (end > 0) {
    const sub = wordTokens(words[end - 1])
    if (sub.length > 0 && sub.every(t => vocab.has(t))) end--
    else break
  }
  return words.slice(0, end).join(' ').trim()
}

// Nom canonique d'une carte, indépendant de sa couleur : null pour la version de
// base (variation vide OU réduite à rien après retrait du suffixe couleur), sinon
// le nom du set/insert sans son suffixe couleur (ex: "Fortune 15 Aqua Refractor" ->
// "Fortune 15"). Deux couleurs différentes de la même carte partagent ce nom, ce qui
// permet de les dédupliquer.
export function canonicalVariation(variation: string | null, vocab: Set<string>): string | null {
  if (!variation) return null
  const stripped = stripColorSuffix(variation, vocab)
  return stripped || null
}
