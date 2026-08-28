-- Favoris sur les annonces /trades (issues soit de trades, soit de cartes
-- galerie marquees en vente -- item_type distingue les deux sources).
CREATE TABLE IF NOT EXISTS trade_favorites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('trade', 'galerie')),
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

ALTER TABLE trade_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir ses favoris" ON trade_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Ajouter un favori" ON trade_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Retirer un favori" ON trade_favorites FOR DELETE USING (auth.uid() = user_id);
