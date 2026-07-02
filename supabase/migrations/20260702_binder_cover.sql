-- Personnalisation des classeurs : image de couverture + sous-titre.
ALTER TABLE binders ADD COLUMN IF NOT EXISTS cover_img text;
ALTER TABLE binders ADD COLUMN IF NOT EXISTS subtitle text;
