-- Les cartes CSV (importées depuis un Google Sheet externe, table `carte_tags`
-- utilisée comme table de "surcharges" par carte clé user_id+card_key, voir
-- collection_tag) n'ont pas de colonne disponible_vente comme cartes_manuelles.
-- Ajoutée pour permettre le bouton "Vente/Trade" du Viewer3D sur les cartes CSV
-- aussi, pas seulement sur les cartes manuelles.
ALTER TABLE carte_tags ADD COLUMN IF NOT EXISTS disponible_vente boolean NOT NULL DEFAULT false;
