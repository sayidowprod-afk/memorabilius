-- Offres d'échange directs entre collectors (distinct de la table "trades" qui est le forum d'annonces)

CREATE TABLE IF NOT EXISTS trade_offers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled')),
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Les cartes impliquées dans un échange direct (owner_id détermine quel côté c'est)
CREATE TABLE IF NOT EXISTS trade_offer_cards (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  card_id  UUID NOT NULL,   -- id dans cartes_manuelles
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_sender   ON trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status   ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offer_cards_trade ON trade_offer_cards(trade_id);
