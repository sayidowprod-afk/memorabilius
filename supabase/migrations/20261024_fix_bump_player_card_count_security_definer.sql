-- Regression introduite par la migration RLS precedente (20261024_cache_tables_rls.sql) :
-- bump_player_card_count() est un trigger sur cartes_manuelles qui ecrit dans
-- player_card_counts a CHAQUE ajout/suppression/modif de carte par un
-- utilisateur normal (role "authenticated", pas service role). En
-- retirant le GRANT direct + activant RLS sans policy sur player_card_counts,
-- ce trigger s'est retrouve sans acces -- "permission denied for table
-- player_card_counts" a chaque ajout de carte, partout sur le site.
-- SECURITY DEFINER fait tourner le trigger avec les privileges du
-- proprietaire de la fonction (qui a acces complet), peu importe qui
-- declenche l'insertion -- meme principe que search_players_by_count,
-- deja SECURITY DEFINER pour la lecture.
CREATE OR REPLACE FUNCTION bump_player_card_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
