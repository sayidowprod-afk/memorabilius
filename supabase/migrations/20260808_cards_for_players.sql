-- RPC : retourne toutes les cartes (avec image) pour une liste de joueurs
-- Utilise l'index idx_cartes_manuelles_nom_lower pour la performance
CREATE OR REPLACE FUNCTION get_cards_for_players(p_player_names TEXT[])
RETURNS TABLE(nom TEXT, annee TEXT, marque TEXT, collection TEXT, collection_tag TEXT, variation TEXT, image_recto TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT nom, annee, marque, collection, collection_tag, variation, image_recto
  FROM cartes_manuelles
  WHERE lower(nom) = ANY(ARRAY(SELECT lower(x) FROM unnest(p_player_names) AS x))
    AND image_recto IS NOT NULL
    AND image_recto <> ''
    AND image_recto NOT LIKE '%placehold%'
  LIMIT 5000;
$$;
