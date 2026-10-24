-- Suggestions de recherche (header, voir /api/search-suggest) : les joueurs
-- qui matchent la requete, tries par nombre de cartes recensees sur le site
-- plutot qu'un ordre arbitraire -- les joueurs les plus presents/populaires
-- remontent en premier (ex: "michael" -> Michael Jordan avant Michael
-- Carter-Williams).
--
-- Compter en direct (GROUP BY sur card_set_entries, 14.8M+ lignes) depasse le
-- statement_timeout des qu'une sous-chaine courante matche beaucoup de lignes
-- (ex: "michael") -- teste, echec en prod. Table de comptage pre-calculee a la
-- place (une ligne par joueur, bien plus petite), maintenue automatiquement
-- par trigger a chaque insert/delete sur card_set_entries plutot que recalculee
-- a la demande.
CREATE TABLE IF NOT EXISTS player_card_counts (
  player_name text PRIMARY KEY,
  card_count  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_player_card_counts_name_trgm
  ON player_card_counts USING gin (player_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION bump_player_card_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO player_card_counts (player_name, card_count)
    VALUES (NEW.player_name, 1)
    ON CONFLICT (player_name) DO UPDATE SET card_count = player_card_counts.card_count + 1;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE player_name = OLD.player_name;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_player_card_count ON card_set_entries;
CREATE TRIGGER trg_bump_player_card_count
AFTER INSERT OR DELETE ON card_set_entries
FOR EACH ROW EXECUTE FUNCTION bump_player_card_count();

-- Lecture rapide (petite table, index trigram) : jamais de GROUP BY/COUNT en
-- direct sur card_set_entries a chaque frappe clavier.
CREATE OR REPLACE FUNCTION search_players_by_count(q text, max_rows int DEFAULT 6)
RETURNS TABLE (player_name text, card_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.player_name, c.card_count
  FROM player_card_counts c
  WHERE c.player_name ILIKE ('%' || q || '%')
  ORDER BY c.card_count DESC, c.player_name ASC
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION search_players_by_count(text, int) TO anon, authenticated;
GRANT SELECT ON player_card_counts TO anon, authenticated;
