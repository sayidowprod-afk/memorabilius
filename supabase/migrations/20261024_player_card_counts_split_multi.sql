-- Une carte avec plusieurs joueurs (ex: "Shaquille O'Neal / Patrick Ewing")
-- creait une entree de recherche a part pour la chaine entiere, comme si
-- c'etait une personne. Le trigger doit compter la carte pour CHAQUE joueur
-- separement (la carte s'affiche deja correctement sur les deux pages
-- joueur, seul le comptage pour la recherche etait faux).
CREATE OR REPLACE FUNCTION split_player_names(s text)
RETURNS SETOF text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(part)
  FROM unnest(regexp_split_to_array(coalesce(s, ''), '\s*[/&]\s*')) AS part
  WHERE trim(part) <> ''
$$;

CREATE OR REPLACE FUNCTION bump_player_card_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  nm text;
  k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR nm IN SELECT split_player_names(NEW.nom) LOOP
      k := norm_player_name(nm);
      INSERT INTO player_card_counts (name_key, display_name, card_count)
      VALUES (k, nm, 1)
      ON CONFLICT (name_key) DO UPDATE SET card_count = player_card_counts.card_count + 1;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOR nm IN SELECT split_player_names(OLD.nom) LOOP
      k := norm_player_name(nm);
      UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE name_key = k;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      FOR nm IN SELECT split_player_names(OLD.nom) LOOP
        k := norm_player_name(nm);
        UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE name_key = k;
      END LOOP;
      FOR nm IN SELECT split_player_names(NEW.nom) LOOP
        k := norm_player_name(nm);
        INSERT INTO player_card_counts (name_key, display_name, card_count)
        VALUES (k, nm, 1)
        ON CONFLICT (name_key) DO UPDATE SET card_count = player_card_counts.card_count + 1;
      END LOOP;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
