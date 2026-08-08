-- RPC pour synchroniser les completions d'un set en une seule requête JOIN
-- Remplace le pattern : get all entry_ids → chunk .in() pour les completions (60+ requêtes)
-- Par un seul appel qui filtre directement par set_id
CREATE OR REPLACE FUNCTION get_set_completions(p_set_id INT, p_user_id UUID)
RETURNS TABLE(
  entry_id      INT,
  completion_id UUID,
  manually_checked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cse.id          AS entry_id,
    usc.id          AS completion_id,
    usc.manually_checked
  FROM card_set_entries cse
  INNER JOIN user_set_completion usc
    ON usc.entry_id = cse.id
    AND usc.user_id = p_user_id
  WHERE cse.set_id = p_set_id;
$$;

-- Index sur user_set_completion(user_id, entry_id) pour cette jointure
CREATE INDEX IF NOT EXISTS idx_user_set_completion_user_entry
  ON user_set_completion(user_id, entry_id);

-- Index sur card_set_entries(set_id) pour les fetches d'entries
CREATE INDEX IF NOT EXISTS idx_card_set_entries_set_id
  ON card_set_entries(set_id);
