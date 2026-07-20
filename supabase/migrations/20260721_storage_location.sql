ALTER TABLE cartes_manuelles
  ADD COLUMN IF NOT EXISTS storage_binder TEXT,
  ADD COLUMN IF NOT EXISTS storage_page   SMALLINT,
  ADD COLUMN IF NOT EXISTS storage_slot   TEXT;
