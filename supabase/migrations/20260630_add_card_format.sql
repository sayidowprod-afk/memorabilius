ALTER TABLE cartes_manuelles ADD COLUMN IF NOT EXISTS format VARCHAR(32) DEFAULT 'standard';

-- Migrer les cartes horizontales existantes
UPDATE cartes_manuelles SET format = 'horizontal' WHERE is_horizontal = true AND (format IS NULL OR format = 'standard');
