// Créneaux de publication conseillés (heure de France, repères du tableau « Quand publier » de l'admin), pour les rappels sur le téléphone de l'admin.
// day : jour de la semaine (0 = dimanche … 6 = samedi) ; hour/min : heure de France.
export interface PubSlot { id: string; pays: string; hour: number; min: number; days: number[]; local: string }
export const PUB_SLOTS: PubSlot[] = [
  { id: 'us-midi', pays: 'États-Unis', hour: 18, min: 0, days: [4, 2], local: '12 h à New York' },
  { id: 'us-soir', pays: 'États-Unis', hour: 1, min: 0, days: [5, 3], local: '19 h à New York' },
  { id: 'ca-midi', pays: 'Canada', hour: 18, min: 0, days: [4, 2], local: '12 h à Montréal' },
  { id: 'gb-midi', pays: 'Royaume-Uni', hour: 13, min: 0, days: [3, 4], local: '12 h à Londres' },
  { id: 'gb-soir', pays: 'Royaume-Uni', hour: 19, min: 0, days: [3, 4], local: '18 h à Londres' },
  { id: 'de-midi', pays: 'Allemagne', hour: 12, min: 0, days: [2, 3, 4], local: '12 h à Berlin' },
  { id: 'de-soir', pays: 'Allemagne', hour: 18, min: 0, days: [2, 3, 4], local: '18 h à Berlin' },
  { id: 'fr-midi', pays: 'France', hour: 12, min: 0, days: [3, 4], local: '12 h à Paris' },
  { id: 'fr-soir', pays: 'France', hour: 18, min: 0, days: [3, 4], local: '18 h à Paris' },
  { id: 'es-aprem', pays: 'Espagne', hour: 14, min: 0, days: [4, 5], local: '14 h à Madrid' },
  { id: 'es-soir', pays: 'Espagne', hour: 21, min: 0, days: [4, 5], local: '21 h à Madrid' },
  { id: 'it-midi', pays: 'Italie', hour: 12, min: 30, days: [2, 3, 4], local: '12 h 30 à Rome' },
  { id: 'it-soir', pays: 'Italie', hour: 20, min: 0, days: [2, 3, 4], local: '20 h à Rome' },
]
