ALTER TABLE public.cartes_manuelles
  ADD COLUMN IF NOT EXISTS lien_vinted TEXT,
  ADD COLUMN IF NOT EXISTS lien_ebay   TEXT;
