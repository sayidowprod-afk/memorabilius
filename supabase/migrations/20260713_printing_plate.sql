-- Tag « Printing Plate » (plaque d'impression, carte 1/1) au même titre que
-- rc / auto / patch. Pas exposé dans les filtres de recherche, uniquement à
-- l'ajout / l'édition d'une carte.

ALTER TABLE cartes_manuelles ADD COLUMN IF NOT EXISTS printing_plate boolean NOT NULL DEFAULT false;
