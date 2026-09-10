-- monthly_additions.count etait mis a jour via un pattern SELECT count puis
-- UPSERT count = N+1 (src/app/api/card-added/route.ts) -- non atomique, meme
-- classe de bug que increment_stats (20260720) : deux ajouts/suppressions
-- rapproches pour le meme utilisateur peuvent lire la meme valeur avant que
-- l'un des deux ecrive, perdant silencieusement un increment/decrement.
-- Utilise en base par get_monthly_card_counts (podium) et par le cron
-- monthly-badge -- une derive silencieuse peut donc fausser le podium et
-- l'attribution du badge "Collectionneur du mois".

CREATE OR REPLACE FUNCTION increment_monthly_additions(p_user_id uuid, p_month text, p_delta integer DEFAULT 1)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO monthly_additions (user_id, month, count)
  VALUES (p_user_id, p_month, GREATEST(0, p_delta))
  ON CONFLICT (user_id, month) DO UPDATE
  SET count = GREATEST(0, monthly_additions.count + p_delta);
$$;

GRANT EXECUTE ON FUNCTION increment_monthly_additions(uuid, text, integer) TO anon, authenticated;
