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
-- card_id = UUID pour les cartes manuelles, URL image pour les cartes CSV
CREATE TABLE IF NOT EXISTS trade_offer_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID    NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  card_id     TEXT    NOT NULL,
  is_manuelle BOOLEAN NOT NULL DEFAULT true,
  -- Snapshot affiché dans l'UI (obligatoire pour les cartes CSV, optionnel pour les manuelles)
  card_nom    TEXT,
  card_annee  TEXT,
  card_marque TEXT,
  card_image  TEXT,
  owner_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_sender   ON trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status   ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offer_cards_trade ON trade_offer_cards(trade_id);
