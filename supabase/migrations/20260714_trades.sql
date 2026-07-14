-- Offres d'échange directs entre collectors (distinct de la table "trades" qui est le forum d'annonces)
-- Si les tables existent déjà avec l'ancien schéma, les ALTER TABLE ci-dessous les mettent à jour.

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
  card_nom    TEXT,
  card_annee  TEXT,
  card_marque TEXT,
  card_image  TEXT,
  owner_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

-- Mise à jour du schéma si la table existait déjà avec l'ancien card_id UUID
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_offer_cards'
      AND column_name = 'card_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE trade_offer_cards ALTER COLUMN card_id TYPE TEXT USING card_id::TEXT;
  END IF;
END $$;

ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS is_manuelle BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS card_nom    TEXT;
ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS card_annee  TEXT;
ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS card_marque TEXT;
ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS card_image  TEXT;

CREATE INDEX IF NOT EXISTS idx_trade_offers_sender   ON trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status   ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offer_cards_trade ON trade_offer_cards(trade_id);
