// 653 : un jeu = une configuration. Pour ajouter un jeu de cartes, on ajoute une entrée dans TCG_GAMES : ses raretés, ses finitions, ses éditions,
// son éditeur et (si elle existe) sa source de données pour les listes de cartes et les prix. Aucun écran à réécrire.

export type TcgGameId = 'pokemon' | 'mtg' | 'yugioh' | 'lorcana' | 'onepiece'

export interface TcgGame {
  id: TcgGameId
  label: string
  emoji: string
  color: string
  publisher: string          // proposé dans « Marque »
  rarities: string[]
  finishes: string[]         // dans « Variation »
  editions: string[]
  numberHint: string         // exemple de numéro dans l'extension
  source: 'tcgdex' | 'scryfall' | null // base externe pour la recherche de cartes et les prix en euros
}

export const TCG_GAMES: TcgGame[] = [
  {
    id: 'pokemon', label: 'Pokémon', emoji: '🟡', color: '#f5c451', publisher: 'Pokémon', numberHint: '025/165', source: 'tcgdex',
    rarities: ['Commune', 'Peu commune', 'Rare', 'Rare Holo', 'Double rare', 'Ultra rare', 'Illustration rare', 'Illustration spéciale rare', 'Rare Hyper', 'Rare secrète', 'Chromatique', 'Promo'],
    finishes: ['Normale', 'Reverse holo', 'Holo', 'Full Art', 'Alt Art', 'Texturée'],
    editions: ['Illimitée', '1re édition', 'Shadowless'],
  },
  {
    id: 'mtg', label: 'Magic : The Gathering', emoji: '🧙', color: '#8a6cf0', publisher: 'Wizards of the Coast', numberHint: '123', source: 'scryfall',
    rarities: ['Commune', 'Peu commune', 'Rare', 'Mythique', 'Spéciale'],
    finishes: ['Normale', 'Foil', 'Etched', 'Showcase', 'Bordure étendue', 'Sans bordure'],
    editions: ['Standard', 'Collector', 'Promo'],
  },
  {
    id: 'yugioh', label: 'Yu-Gi-Oh!', emoji: '🔮', color: '#c0392b', publisher: 'Konami', numberHint: 'LOB-EN001', source: null,
    rarities: ['Commune', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare', 'Ghost Rare', 'Starlight Rare', 'Collector’s Rare'],
    finishes: ['Normale', 'Foil', 'Parallèle'],
    editions: ['1re édition', 'Illimitée', 'Limitée'],
  },
  {
    id: 'lorcana', label: 'Disney Lorcana', emoji: '✨', color: '#2f6bff', publisher: 'Ravensburger', numberHint: '12/204', source: null,
    rarities: ['Commune', 'Peu commune', 'Rare', 'Super rare', 'Légendaire', 'Enchantée'],
    finishes: ['Normale', 'Foil', 'Cold Foil'],
    editions: ['Standard', 'Promo'],
  },
  {
    id: 'onepiece', label: 'One Piece', emoji: '🏴‍☠️', color: '#e0a526', publisher: 'Bandai', numberHint: 'OP01-001', source: null,
    rarities: ['Commune', 'Peu commune', 'Rare', 'Super Rare', 'Secret Rare', 'Leader', 'Spéciale'],
    finishes: ['Normale', 'Alt Art', 'Parallèle', 'Manga'],
    editions: ['Standard', 'Promo'],
  },
]

export const TCG_LANGUAGES = ['FR', 'EN', 'JP', 'DE', 'ES', 'IT', 'PT', 'KO', 'ZH']
// échelle de Cardmarket : Mint, Near Mint, Excellent, Good, Light Played, Played, Poor
export const TCG_CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO']

export function getTcgGame(id?: string | null): TcgGame | null {
  return TCG_GAMES.find(g => g.id === id) ?? null
}
export const isTcg = (jeu?: string | null): boolean => !!getTcgGame(jeu)

// Libellés des champs dans chaque langue du site (repli : français)
type Lbl = Record<'fr' | 'en' | 'de' | 'es' | 'it', string>
export const TCG_LABELS: Record<string, Lbl> = {
  focus: { fr: 'Je collectionne', en: 'I collect', de: 'Ich sammle', es: 'Colecciono', it: 'Colleziono' },
  focusSub: { fr: 'Adapte les écrans : les cartes à jouer (Pokémon, Magic…) ont leurs propres champs.', en: 'Adapts the screens: trading card games (Pokémon, Magic…) have their own fields.', de: 'Passt die Bildschirme an: Sammelkartenspiele (Pokémon, Magic…) haben eigene Felder.', es: 'Adapta las pantallas: los juegos de cartas (Pokémon, Magic…) tienen sus propios campos.', it: 'Adatta le schermate: i giochi di carte (Pokémon, Magic…) hanno campi propri.' },
  both: { fr: 'Les deux', en: 'Both', de: 'Beides', es: 'Ambos', it: 'Entrambi' },
  kind: { fr: 'Type de carte', en: 'Card type', de: 'Kartentyp', es: 'Tipo de carta', it: 'Tipo di carta' },
  sport: { fr: 'Sport', en: 'Sport', de: 'Sport', es: 'Deportes', it: 'Sport' },
  tcg: { fr: 'TCG', en: 'TCG', de: 'TCG', es: 'TCG', it: 'TCG' },
  game: { fr: 'Jeu', en: 'Game', de: 'Spiel', es: 'Juego', it: 'Gioco' },
  name: { fr: 'Nom de la carte', en: 'Card name', de: 'Kartenname', es: 'Nombre de la carta', it: 'Nome della carta' },
  set: { fr: 'Extension', en: 'Set', de: 'Erweiterung', es: 'Expansión', it: 'Espansione' },
  number: { fr: 'Numéro', en: 'Number', de: 'Nummer', es: 'Número', it: 'Numero' },
  rarity: { fr: 'Rareté', en: 'Rarity', de: 'Seltenheit', es: 'Rareza', it: 'Rarità' },
  language: { fr: 'Langue', en: 'Language', de: 'Sprache', es: 'Idioma', it: 'Lingua' },
  edition: { fr: 'Édition', en: 'Edition', de: 'Edition', es: 'Edición', it: 'Edizione' },
  finish: { fr: 'Finition', en: 'Finish', de: 'Ausführung', es: 'Acabado', it: 'Finitura' },
  condition: { fr: 'État', en: 'Condition', de: 'Zustand', es: 'Estado', it: 'Condizione' },
  year: { fr: 'Année', en: 'Year', de: 'Jahr', es: 'Año', it: 'Anno' },
  grade: { fr: 'Gradation', en: 'Grade', de: 'Bewertung', es: 'Gradación', it: 'Gradazione' },
  find: { fr: 'Rechercher la carte', en: 'Find the card', de: 'Karte suchen', es: 'Buscar la carta', it: 'Cerca la carta' },
  filled: { fr: 'Carte reconnue : champs remplis', en: 'Card found: fields filled', de: 'Karte gefunden: Felder ausgefüllt', es: 'Carta encontrada: campos rellenados', it: 'Carta trovata: campi compilati' },
  none: { fr: 'Aucun résultat', en: 'No result', de: 'Kein Ergebnis', es: 'Sin resultados', it: 'Nessun risultato' },
  price: { fr: 'Prix Cardmarket', en: 'Cardmarket price', de: 'Cardmarket-Preis', es: 'Precio Cardmarket', it: 'Prezzo Cardmarket' },
}
export function tcgLabel(key: string, lang: string): string {
  const l = TCG_LABELS[key]
  if (!l) return key
  return (l as Record<string, string>)[lang] || l.fr
}

// Résumé court d'une carte TCG (tuile, listes) : « Extension · n° · Rareté »
export function tcgSummary(c: { collection?: string; s?: string; card_number?: string; rarete?: string }): string {
  return [c.collection ?? c.s, c.card_number, c.rarete].filter(Boolean).join(' · ')
}
