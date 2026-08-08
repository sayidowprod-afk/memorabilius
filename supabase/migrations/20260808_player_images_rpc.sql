-- Index fonctionnel sur lower(nom) pour accélérer le JOIN avec card_set_entries
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_nom_lower
  ON cartes_manuelles(lower(nom));

-- RPC : pour chaque entry_id, trouve la première image disponible dans cartes_manuelles
-- (n'importe quel utilisateur du site) en faisant le lien via player_name ↔ nom
CREATE OR REPLACE FUNCTION get_player_images_for_entries(p_entry_ids INT[])
RETURNS TABLE(entry_id INT, image_url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (cse.id)
    cse.id        AS entry_id,
    cm.image_recto AS image_url
  FROM card_set_entries cse
  INNER JOIN cartes_manuelles cm
    ON lower(cm.nom) = lower(cse.player_name)
    AND cm.image_recto IS NOT NULL
    AND cm.image_recto <> ''
    AND cm.image_recto NOT LIKE '%placehold%'
  WHERE cse.id = ANY(p_entry_ids)
  ORDER BY cse.id, cm.created_at ASC;
$$;
