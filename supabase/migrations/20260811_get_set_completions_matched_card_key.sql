-- Ajoute matched_card_key au retour de get_set_completions
-- Permet d'afficher la bonne image de carte dans la setlist (choix explicite de l'utilisateur)
DROP FUNCTION IF EXISTS get_set_completions(integer, uuid);

CREATE OR REPLACE FUNCTION get_set_completions(p_set_id INT, p_user_id UUID)
RETURNS TABLE(
  entry_id         INT,
  completion_id    UUID,
  manually_checked BOOLEAN,
  matched_card_key TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cse.id               AS entry_id,
    usc.id               AS completion_id,
    usc.manually_checked,
    usc.matched_card_key
  FROM card_set_entries cse
  INNER JOIN user_set_completion usc
    ON usc.entry_id = cse.id
    AND usc.user_id = p_user_id
  WHERE cse.set_id = p_set_id;
$$;
