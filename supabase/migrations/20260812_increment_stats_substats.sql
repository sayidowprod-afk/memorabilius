-- Étend increment_stats pour mettre à jour les sous-stats (rc, auto, patch, num)
-- en même temps que stats_total, de façon atomique.
-- Rétro-compatible : les appels existants sans les paramètres optionnels continuent de fonctionner.

CREATE OR REPLACE FUNCTION increment_stats(
  p_user_id uuid,
  p_delta   integer DEFAULT 1,
  p_rc      integer DEFAULT 0,
  p_auto    integer DEFAULT 0,
  p_patch   integer DEFAULT 0,
  p_num     integer DEFAULT 0
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET
    stats_total = GREATEST(0, COALESCE(stats_total, 0) + p_delta),
    stats_rc    = GREATEST(0, COALESCE(stats_rc,    0) + p_rc),
    stats_auto  = GREATEST(0, COALESCE(stats_auto,  0) + p_auto),
    stats_patch = GREATEST(0, COALESCE(stats_patch,  0) + p_patch),
    stats_num   = GREATEST(0, COALESCE(stats_num,    0) + p_num)
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION increment_stats(uuid, integer, integer, integer, integer, integer) TO anon, authenticated;
