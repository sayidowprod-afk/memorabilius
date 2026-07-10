-- Permet au verso d'une carte d'avoir une orientation différente du recto
-- (ex: recto vertical, verso à l'horizontale). NULL = même orientation que le recto
-- (is_horizontal), pour ne pas casser les cartes existantes.

ALTER TABLE cartes_manuelles ADD COLUMN IF NOT EXISTS verso_is_horizontal boolean;
