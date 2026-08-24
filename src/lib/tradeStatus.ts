// Statut d'une offre d'echange (trade_offers.status) — les couleurs etaient
// deja identiques partout (echanges, trades, messages, ChatBubble) mais
// dupliquees dans 4 fichiers ; centralise ici comme source unique.
export type TradeStatus = 'pending' | 'accepted' | 'refused' | 'cancelled'

export const TRADE_STATUS_COLOR: Record<TradeStatus, { color: string; bg: string }> = {
  pending:   { color: '#7a5500', bg: '#fff8e1' },
  accepted:  { color: '#1b5e20', bg: '#e8f5e9' },
  refused:   { color: '#7f0000', bg: '#ffebee' },
  cancelled: { color: '#555',    bg: '#f5f5f5' },
}
