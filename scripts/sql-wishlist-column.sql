-- Colonne wishlist pour user_set_completion : permet de marquer une carte comme
-- "je la veux" sans la cocher comme possedee -- utilise par la grille checklist
-- joueur (PlayerChecklistSection.tsx). A executer dans Supabase SQL Editor.

ALTER TABLE user_set_completion ADD COLUMN IF NOT EXISTS wishlist boolean NOT NULL DEFAULT false;
