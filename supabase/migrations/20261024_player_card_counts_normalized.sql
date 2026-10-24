-- Correction : "shaq" faisait apparaitre "Shaquille O'Neal" en double/triple
-- dans les suggestions -- le comptage groupait par nom EXACT (nom), et
-- plusieurs collectionneurs ont saisi le meme joueur avec une casse ou une
-- apostrophe differente ("O'Neal" vs "O'neal" vs "O’Neal" ...), donc chaque
-- variante comptait comme une personne separee. Reconstruit la table avec
-- une cle normalisee (minuscule, accents retires, espaces reduits) ; le nom
-- affiche est la variante la plus frequente pour cette cle.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION norm_player_name(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(unaccent(coalesce(s, ''))), '\s+', ' ', 'g'))
$$;

DROP TRIGGER IF EXISTS trg_bump_player_card_count ON cartes_manuelles;
DROP FUNCTION IF EXISTS bump_player_card_count();
DROP FUNCTION IF EXISTS search_players_by_count(text, int);
DROP TABLE IF EXISTS player_card_counts;

CREATE TABLE player_card_counts (
  name_key     text PRIMARY KEY,
  display_name text NOT NULL,
  card_count   integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_player_card_counts_display_trgm
  ON player_card_counts USING gin (display_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION bump_player_card_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_key text;
  new_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.nom IS NOT NULL THEN
      new_key := norm_player_name(NEW.nom);
      INSERT INTO player_card_counts (name_key, display_name, card_count)
      VALUES (new_key, NEW.nom, 1)
      ON CONFLICT (name_key) DO UPDATE SET card_count = player_card_counts.card_count + 1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.nom IS NOT NULL THEN
      old_key := norm_player_name(OLD.nom);
      UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE name_key = old_key;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      IF OLD.nom IS NOT NULL THEN
        old_key := norm_player_name(OLD.nom);
        UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE name_key = old_key;
      END IF;
      IF NEW.nom IS NOT NULL THEN
        new_key := norm_player_name(NEW.nom);
        INSERT INTO player_card_counts (name_key, display_name, card_count)
        VALUES (new_key, NEW.nom, 1)
        ON CONFLICT (name_key) DO UPDATE SET card_count = player_card_counts.card_count + 1;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bump_player_card_count
AFTER INSERT OR DELETE OR UPDATE OF nom ON cartes_manuelles
FOR EACH ROW EXECUTE FUNCTION bump_player_card_count();

CREATE OR REPLACE FUNCTION search_players_by_count(q text, max_rows int DEFAULT 6)
RETURNS TABLE (player_name text, card_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.display_name, c.card_count
  FROM player_card_counts c
  WHERE c.name_key ILIKE ('%' || norm_player_name(q) || '%')
  ORDER BY c.card_count DESC, c.display_name ASC
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION search_players_by_count(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION norm_player_name(text) TO anon, authenticated;
GRANT SELECT ON player_card_counts TO anon, authenticated;
