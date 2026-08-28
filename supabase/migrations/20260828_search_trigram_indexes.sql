-- Recherche full-text/rapide sur /recherche et /annuaire : les requetes
-- utilisent deja des ILIKE '%terme%' (wildcard des deux cotes), qu'un index
-- B-tree classique (voir idx_cartes_manuelles_nom, deja en place) ne peut
-- PAS accelerer -- il faut un index trigram (pg_trgm, deja active pour
-- card_set_entries.player_name). On l'etend aux colonnes reellement
-- cherchees par /api/recherche plutot que de reecrire la requete en
-- tsvector (qui changerait le comportement : matching par mot entier/racine
-- au lieu de sous-chaine, ex. "Jor" ne matcherait plus "Jordan" au milieu).
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_nom_trgm
  ON cartes_manuelles USING gin (nom gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_equipe_trgm
  ON cartes_manuelles USING gin (equipe gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_variation_trgm
  ON cartes_manuelles USING gin (variation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_marque_trgm
  ON cartes_manuelles USING gin (marque gin_trgm_ops);

-- profiles.display_name : cherche dans /api/recherche (collectionneurs) et
-- utilisable pour la recherche annuaire.
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON profiles USING gin (display_name gin_trgm_ops);
