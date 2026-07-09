-- Mémorise si la carte insérée dans un classeur est au format horizontal,
-- pour pouvoir l'afficher pivotée (à la verticale) dans les pochettes du classeur.

ALTER TABLE binder_slots ADD COLUMN IF NOT EXISTS is_horizontal boolean NOT NULL DEFAULT false;
