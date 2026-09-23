-- Systeme d'echange v2 : contre-offres, expiration, suivi apres acceptation, avis.
-- Additive uniquement (aucune donnee existante modifiee, hors backfill de
-- expires_at sur les offres deja en attente).

-- Nouveaux statuts
--   countered : remplacee par une contre-offre du destinataire
--   expired   : sans reponse avant expires_at
--   completed : les deux parties ont confirme la reception
ALTER TABLE trade_offers DROP CONSTRAINT IF EXISTS trade_offers_status_check;
ALTER TABLE trade_offers ADD CONSTRAINT trade_offers_status_check
  CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled', 'countered', 'expired', 'completed'));

-- Contre-offre : lien vers l'offre d'origine
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS parent_offer_id UUID REFERENCES trade_offers(id) ON DELETE SET NULL;

-- Expiration + relances (traitees par /api/cron/trade-expiry)
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS reminder_sent_at  TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS followup_sent_at  TIMESTAMPTZ;
UPDATE trade_offers SET expires_at = NOW() + INTERVAL '7 days' WHERE status = 'pending' AND expires_at IS NULL;

-- Suivi apres acceptation (confirmations manuelles des deux parties)
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS sender_shipped_at    TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS receiver_shipped_at  TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS sender_received_at   TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS receiver_received_at TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS accepted_at          TIMESTAMPTZ;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trade_offers_expires ON trade_offers(expires_at) WHERE status = 'pending';

-- Avis apres un echange termine (un par personne et par echange)
CREATE TABLE IF NOT EXISTS trade_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trade_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_reviewed ON trade_reviews(reviewed_id);

ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture publique (la reputation s'affiche sur les profils) ; ecriture
-- uniquement via l'API (service role) qui verifie que l'echange est termine
-- et que l'auteur y a participe.
DROP POLICY IF EXISTS "trade_reviews_select" ON trade_reviews;
CREATE POLICY "trade_reviews_select" ON trade_reviews FOR SELECT USING (true);
