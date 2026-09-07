-- Quota hebdomadaire du scanner de prix (eBay) pour les non-membres de la
-- Fédération de la carte (10 utilisations/semaine, illimité pour les membres).
CREATE TABLE IF NOT EXISTS price_scan_usage (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_start)
);
