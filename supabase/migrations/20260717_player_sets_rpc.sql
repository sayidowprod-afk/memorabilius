-- RPC : retourne tous les sets d'un joueur en une seule requête (JOIN + GROUP BY)
-- Évite la pagination par OFFSET (lente sur grandes tables sans index)
-- Pour de meilleures performances, créer l'index trigram en dashboard Supabase :
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX CONCURRENTLY idx_card_set_entries_player_name_trgm
--     ON card_set_entries USING gin (player_name gin_trgm_ops);
CREATE OR REPLACE FUNCTION get_player_sets(
  p_first text,
  p_last  text
)
RETURNS TABLE (
  id          bigint,
  name        text,
  year        int,
  brand       text,
  sport       text,
  is_rc       boolean,
  variations  text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cs.id,
    cs.name,
    cs.year,
    cs.brand,
    cs.sport,
    bool_or(e.is_rc)                              AS is_rc,
    array_remove(array_agg(DISTINCT e.variation), NULL) AS variations
  FROM card_set_entries e
  JOIN card_sets cs ON cs.id = e.set_id
  WHERE e.player_name ILIKE (p_first || '%')
    AND e.player_name ILIKE ('%' || p_last || '%')
  GROUP BY cs.id, cs.name, cs.year, cs.brand, cs.sport
  ORDER BY cs.year DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_player_sets(text, text) TO anon, authenticated;
