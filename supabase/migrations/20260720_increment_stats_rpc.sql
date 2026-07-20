-- BUG-02 : Incrément atomique des stats pour éviter la race condition read-modify-write
-- Remplace le pattern SELECT stats_total puis UPDATE stats_total = N+1

CREATE OR REPLACE FUNCTION increment_stats(p_user_id uuid, p_delta integer DEFAULT 1)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles
  SET stats_total = GREATEST(0, COALESCE(stats_total, 0) + p_delta)
  WHERE id = p_user_id;
$$;
