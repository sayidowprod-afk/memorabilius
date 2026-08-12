-- Lien direct entre une carte de galerie et son entrée setlist
-- Evite le fuzzy-matching à chaque synchro et permet l'affichage dans Viewer3D
ALTER TABLE cartes_manuelles
  ADD COLUMN IF NOT EXISTS set_entry_id INTEGER REFERENCES card_set_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_set_entry_id
  ON cartes_manuelles(set_entry_id)
  WHERE set_entry_id IS NOT NULL;
