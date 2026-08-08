-- Index fonctionnel sur lower(nom) pour accélérer le JOIN avec card_set_entries
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_nom_lower
  ON cartes_manuelles(lower(nom));

-- RPC : pour chaque entry_id, trouve la première image disponible dans cartes_manuelles
-- en matchant : joueur + année + variation + collection (même logique que set-sync)
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
  INNER JOIN card_sets cs ON cs.id = cse.set_id
  INNER JOIN cartes_manuelles cm
    ON -- 1. Joueur (nom exact, insensible à la casse)
       lower(trim(cm.nom)) = lower(trim(cse.player_name))
    AND cm.image_recto IS NOT NULL
    AND cm.image_recto <> ''
    AND cm.image_recto NOT LIKE '%placehold%'
    -- 2. Année : vide (pas de contrainte) OU correspond à l'année du set
    --    Formats acceptés : "2025", "2025-26", "2026", "2025-2026"
    AND (
      COALESCE(trim(cm.annee), '') = ''
      OR cm.annee = cs.year::text
      OR cm.annee = (cs.year::text || '-' || right((cs.year + 1)::text, 2))
      OR cm.annee = (cs.year + 1)::text
      OR cm.annee = (cs.year::text || '-' || (cs.year + 1)::text)
    )
    -- 3. Variation : Base-à-Base (les deux vides/null) OU variation de la carte
    --    contenue dans la variation de l'entrée (insensible à la casse)
    AND (
      (cse.variation IS NULL AND COALESCE(trim(cm.variation), '') = '')
      OR (
        cse.variation IS NOT NULL
        AND COALESCE(trim(cm.variation), '') <> ''
        AND lower(cse.variation) LIKE '%' || lower(trim(cm.variation)) || '%'
      )
    )
    -- 4. Collection : vide (pas de contrainte) OU au moins un mot commun avec le nom du set
    AND (
      COALESCE(trim(cm.collection), '') = ''
      OR lower(cs.name) LIKE '%' || lower(trim(cm.collection)) || '%'
      OR lower(trim(cm.collection)) LIKE '%' || lower(cs.name) || '%'
    )
  WHERE cse.id = ANY(p_entry_ids)
  ORDER BY cse.id, cm.created_at ASC;
$$;
