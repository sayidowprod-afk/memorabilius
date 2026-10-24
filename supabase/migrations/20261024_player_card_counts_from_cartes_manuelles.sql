-- Correction : "le plus de cartes" doit compter les cartes AJOUTEES PAR LES
-- UTILISATEURS (cartes_manuelles.nom), pas le catalogue de checklist
-- (card_set_entries) -- la premiere version comptait le catalogue, ce qui
-- faisait remonter des joueurs NFL recents (sets avec beaucoup de paralleles
-- scrapes) devant des legendes comme Jordan, contraire a l'intention
-- ("michael" -> Michael Jordan en premier si les collectionneurs en ont
-- beaucoup).
DROP TRIGGER IF EXISTS trg_bump_player_card_count ON card_set_entries;
DROP FUNCTION IF EXISTS bump_player_card_count();
TRUNCATE player_card_counts;

CREATE OR REPLACE FUNCTION bump_player_card_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.nom IS NOT NULL THEN
      INSERT INTO player_card_counts (player_name, card_count)
      VALUES (NEW.nom, 1)
      ON CONFLICT (player_name) DO UPDATE SET card_count = player_card_counts.card_count + 1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.nom IS NOT NULL THEN
      UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE player_name = OLD.nom;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Une carte peut etre re-attribuee a un autre joueur depuis l'editeur
    -- (champ nom modifie) -- decremente l'ancien, incremente le nouveau.
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      IF OLD.nom IS NOT NULL THEN
        UPDATE player_card_counts SET card_count = GREATEST(0, card_count - 1) WHERE player_name = OLD.nom;
      END IF;
      IF NEW.nom IS NOT NULL THEN
        INSERT INTO player_card_counts (player_name, card_count)
        VALUES (NEW.nom, 1)
        ON CONFLICT (player_name) DO UPDATE SET card_count = player_card_counts.card_count + 1;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bump_player_card_count
AFTER INSERT OR DELETE OR UPDATE OF nom ON cartes_manuelles
FOR EACH ROW EXECUTE FUNCTION bump_player_card_count();
